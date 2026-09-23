# Промпт для AI-кодогенератора: «Граф денег»

Построить веб-приложение для AML-аналитика банка, которое по выгрузке транзакций
(3 parquet-файла: `edges`, `nodes`, `transactions`) строит граф денежных потоков,
присваивает каждому из ~2248 узлов роль в организованной группе, ранжирует узлы по
приоритету проверки и даёт аналитику визуальную схему сети + объяснимый топ-лист.

## СТЕК

- **Бэкенд**: Python 3.11+, FastAPI, `pandas`, `pyarrow` (чтение parquet), `networkx`
  (граф, degree, betweenness, pagerank, компоненты связности), `python-louvain` (или
  `networkx.algorithms.community.louvain_communities`) для кластеризации.
- **Фронтенд**: Next.js 14 (App Router), TypeScript, Tailwind — только визуализация,
  все данные получает по HTTP от бэкенда. Граф — `react-cytoscapejs` или
  `react-force-graph-2d`.
- **LLM**: OpenAI SDK (python `openai`) — интерактивный AI-ассистент; NVIDIA NIM
  (OpenAI-совместимый REST, `https://integrate.api.nvidia.com/v1/chat/completions`,
  можно тем же `openai` клиентом с другим `base_url`) — дешёвая батчевая полировка
  `evidence`-текстов. Оба вызова — опциональная надстройка с шаблонным fallback.
- **Деплой**: docker-compose из двух сервисов — `backend` (FastAPI, порт 8000) и
  `frontend` (Next.js, порт 3000), либо Next.js `rewrites()` проксирует `/api/*` на
  бэкенд, чтобы наружу торчал один URL.
- Хранение промежуточных данных — CSV-файлы на диске, без БД.

## СТРУКТУРА РЕПОЗИТОРИЯ

```
/data/raw/                       -- edges.parquet, nodes.parquet, transactions.parquet
/data/output/                    -- nodes_roles.csv, clusters.csv, top_nodes.csv
/backend/
  app/
    main.py                      -- FastAPI приложение, роуты
    pipeline/
      load_data.py               -- чтение parquet (pandas/pyarrow), базовые агрегации
      build_graph.py             -- сборка networkx.DiGraph из edges
      metrics.py                 -- degree, betweenness, pagerank, компоненты, Louvain
      roles.py                   -- rule-based присвоение роли + role_score + evidence (шаблонно)
      priority.py                -- расчёт priority_score
      enrich_with_llm.py         -- батчевый вызов NVIDIA NIM для полировки evidence
      export_csv.py              -- запись 3 CSV
      run.py                     -- точка входа: python -m app.pipeline.run
    routers/
      graph.py                   -- GET /graph
      pipeline.py                -- POST /pipeline/run
      assistant.py                -- POST /assistant (OpenAI)
    llm_clients.py                -- обёртки над OpenAI/NVIDIA клиентами
  requirements.txt
  Dockerfile
/frontend/
  app/page.tsx                    -- дашборд: граф + поиск по gid + топ-лист + карточка узла
  components/
    GraphView.tsx
    TopList.tsx
    NodeCard.tsx
    AssistantPanel.tsx
  next.config.js                   -- rewrites на бэкенд (опционально)
  Dockerfile
docker-compose.yml
README.md                          -- команда запуска, критерии ролей и пороги, ограничения, раздел про масштабирование до ~1 млн узлов
```

## СХЕМА ДАННЫХ НА ВХОДЕ

- `edges.parquet`: `src`, `dst`, `sum_kzt`, `n_tx`, `depth` — агрегированная пара плательщик→получатель за период.
- `nodes.parquet`: `gid`, `depth` (минимальное колено от seed), `is_seed` (bool).
- `transactions.parquet`: `src`, `dst`, `date`, `sum_kzt` — отдельные транзакции (используются только для опциональных временных паттернов).

Важные особенности данных, которые пайплайн обязан учитывать:

- 444 узла с `depth=4` и нулевым out-degree — это **артефакт обрыва обхода на 4-м колене**,
  а не подтверждённый конечный получатель. Такие узлы нельзя молча маркировать `terminal`
  наравне с настоящими терминалами (`depth<4` и out-degree=0) — см. правила ролей ниже.
- Есть только исходящие переводы: входящие потоки на узлы за пределами выборки не видны,
  у seed-клиентов входящие суммы занижены (граф собран от них).
- Порог отсечения 5000 KZT — дробление ниже порога невидимо, это должно быть явно написано в README как ограничение.
- 16 слабосвязных компонент — граф не монолитен, кластеризацию делать в рамках компонент.
- Никаких атрибутов клиента (ФИО, возраст и т.п.) — не выдумывать и не обогащать данные.

## РАСЧЁТ МЕТРИК (на узел gid, в `metrics.py`)

Из `edges` (агрегированных src→dst), через pandas groupby:

- `in_partners` = число уникальных `src`, где `dst = gid`
- `out_partners` = число уникальных `dst`, где `src = gid`
- `sum_in` = сумма `sum_kzt` по рёбрам, где `dst = gid`
- `sum_out` = сумма `sum_kzt` по рёбрам, где `src = gid`
- `pass_ratio` = `sum_out / sum_in`, если `sum_in > 0`, иначе `None`

Из графа (networkx):

- `betweenness` = `nx.betweenness_centrality(G, normalized=True)` (для скорости на 2248
  узлах можно без сэмплинга; в README указать, что для ~1 млн узлов нужен
  `k`-сэмплинг или приближённые алгоритмы)
- `pagerank` = `nx.pagerank(G)`
- `component_id` — `nx.weakly_connected_components(G)`
- `cluster_id` — Louvain внутри каждой компоненты отдельно

## ПРАВИЛА ПРИСВОЕНИЯ РОЛЕЙ (rule-based, пороги — константы в `roles.py`, документировать в README)

Применять по приоритету сверху вниз, первое совпадение побеждает:

1. **`coordinator`** — `betweenness` в топ-5% по всему графу И (`is_seed = true` ИЛИ узел
   соединяет ≥2 разных кластера через свои рёбра) И `in_partners + out_partners >= 5`.
2. **`consolidator`** — `in_partners >= 8` И (`pass_ratio` не определён ИЛИ `pass_ratio < 0.3`).
3. **`distributor`** — `out_partners >= 15`.
4. **`transit`** — `pass_ratio` определён И `0.8 <= pass_ratio <= 1.2` И `in_partners >= 1` И `out_partners >= 1`.
5. **`terminal`** — `out_partners = 0` И `depth < 4` (настоящий сток, не артефакт обрыва).
   Если `out_partners = 0` И `depth = 4`: присвоить `terminal`, но с явным флагом
   `truncated = true` в `evidence` («возможный конечный получатель — цепочка не прослежена
   дальше 4-го колена, требует уточнения»), и `role_score` снизить (например, ×0.6).
6. **`peripheral`** — всё остальное.

`role_score` (0–1) — насколько уверенно узел попадает под правило: отношение фактического
значения метрики к порогу, клиппированное в [0,1] (узел с `in_partners=20` при пороге 8
получает более высокий `role_score`, чем узел с `in_partners=9`).

## PRIORITY_SCORE (`priority.py`)

```
priority_score = clip(
  0.35 * norm(betweenness) +
  0.25 * norm(pagerank) +
  0.20 * norm(in_partners) +
  0.10 * norm(out_partners) +
  0.10 * (1 if is_seed else 0),
  0, 1
)
```

где `norm(x)` — min-max нормализация по всему графу (numpy/pandas). Роли `coordinator` и
`consolidator` получают множитель `×1.15` (клиппинг к 1.0) — приоритетные кандидаты для проверки.

## EVIDENCE (объяснение роли, до 200 символов)

Шаг 1 — шаблонная генерация без LLM (обязательный fallback, чтобы must-have не зависел
от доступности API):

```python
f"Получает от {in_partners} разных плательщиков, отдаёт дальше {pass_ratio*100:.0f}% полученного"
```

Шаг 2 (опционально) — прогнать шаблонные evidence батчами по 20-30 узлов через NVIDIA NIM
для более естественной формулировки. Системный промпт:

```
Ты помощник AML-аналитика. Тебе дают список узлов транзакционного графа с их метриками.
Перепиши каждое evidence-объяснение в одно короткое (до 200 символов) человекочитаемое
предложение на русском языке. Не добавляй фактов, которых нет в метриках. Не делай
утверждений о виновности — формулируй как наблюдение о структуре потоков ("признаки
консолидации", а не "отмывает деньги"). Верни строго JSON-массив объектов
{gid, evidence} в том же порядке, без каких-либо пояснений вне JSON.

Данные по узлам:
{JSON с gid, role, in_partners, out_partners, sum_in, sum_out, pass_ratio, betweenness, is_seed}
```

Если вызов LLM падает или превышает лимит времени — использовать шаблонный evidence без
блокировки пайплайна (try/except с fallback на шаблон).

## КЛАСТЕРЫ (`clusters.csv`)

Для каждого `cluster_id`: `n_nodes`, `n_seed` (число seed-узлов в кластере), `sum_kzt_internal`
(сумма всех внутрикластерных рёбер), `top_gids` (топ-5 по priority_score через `;`),
`hypothesis` — одна строка текстом (тем же LLM-механизмом с шаблонным fallback вида
"Кластер из {n_nodes} узлов, {n_seed} из них — известные seed-клиенты, внутренний оборот {sum} KZT").

## TOP_NODES.CSV

`rank, gid, role, priority_score, why` — не менее 20 строк, отсортировано по `priority_score`
убыванию. `why` — 1-2 предложения, можно переиспользовать `evidence` + упоминание кластера.

## API (FastAPI, `backend/app/routers/`)

- `GET /graph` → `{ nodes: [...], edges: [...], clusters: [...] }` — читает CSV из
  `data/output`, отдаёт JSON для рендера графа. Кэшировать в памяти процесса
  (перечитывать только после `/pipeline/run`).
- `POST /pipeline/run` → запускает `app.pipeline.run.main()` (в `BackgroundTasks` или
  subprocess), возвращает статус/лог — для демо-кнопки «пересчитать».
- `POST /assistant` body `{ "question": str }` →
  1. Найти в вопросе упомянутые gid (regex по числам) и/или интерпретировать намерение
     (топ по роли, окружение узла и т.п.).
  2. Собрать релевантный контекст: сами узлы + их прямые соседи по рёбрам (не весь граф).
  3. Отправить в OpenAI с системным промптом:

     ```
     Ты AML-ассистент. Отвечай ТОЛЬКО на основе предоставленных данных о графе.
     Если данных не хватает — прямо скажи, каких данных не хватает. Никогда не утверждай
     виновность — формулируй как гипотезы для проверки. Ссылайся на gid узлов, которые
     упоминаешь.
     ```

  4. Вернуть `{ answer: str, mentioned_gids: number[] }` (для подсветки на графе).

Next.js либо ходит напрямую на `http://backend:8000` (внутри docker-сети) через
`fetch` в серверных компонентах, либо проксирует через `next.config.js` `rewrites()`,
чтобы с браузера был один origin.

## ФРОНТЕНД (`frontend/app/page.tsx`)

- Граф-схема на всю ширину: цвет узла = роль (легенда), обводка/фон = кластер, толщина
  ребра = `sum_kzt` (лог-шкала), стрелка = направление.
- Поиск по `gid` — подсвечивает узел и центрирует граф на нём.
- Правая панель: топ-лист (таблица из `GET /graph`, кликабельные строки).
- Клик по узлу → карточка: роль, `role_score`, `priority_score`, `evidence`, список
  входящих/исходящих связей.
- Нижняя панель (опционально): чат с AI-ассистентом (`POST /assistant`).

## README.md (обязательно)

- Одна команда запуска: `docker compose up --build` (пайплайн можно гонять
  автоматически при старте `backend`, либо отдельной командой
  `docker compose run backend python -m app.pipeline.run`) + время выполнения.
- Таблица порогов для каждой роли (скопировать из этого ТЗ) — жюри должно за минуту
  понять, почему узел получил роль.
- Явный список ограничений данных (артефакт 4-го колена, только исходящие переводы,
  порог 5000 KZT, seed с заниженными входящими, 16 компонент).
- Раздел «Масштабирование до ~1 млн узлов»: текстом — переход с in-memory networkx на
  потоковую агрегацию в БД (например DuckDB/Postgres) для метрик первого порядка,
  приближённые/сэмплинговые алгоритмы centrality, инкрементальный пересчёт вместо
  полного батча, персистентное графовое хранилище вместо CSV.

## ЖЁСТКИЕ ЗАПРЕТЫ

- Не хардкодить gid или "правильные" роли — только вычисление из метрик.
- Не присваивать роль без сохранённого правила/порога, объясняющего решение.
- Не добавлять придуманные атрибуты клиента (ФИО, возраст, доход и т.п.).
- Пайплайн не должен требовать GPU, облака или платных сервисов, кроме опционального
  вызова LLM API (с шаблонным fallback без него).
- Финальные формулировки evidence/hypothesis — только в форме гипотезы, не утверждения о виновности.

## ПОРЯДОК СБОРКИ (рекомендуемая последовательность для кодогенератора)

1. Каркас `backend/` (FastAPI + requirements) и `frontend/` (Next.js + Tailwind), docker-compose.
2. `pipeline/load_data.py` + `build_graph.py` — убедиться, что граф строится и числа
   (2248 узлов, 3119 рёбер) сходятся.
3. `metrics.py` + `roles.py` + `priority.py` — без LLM, чисто rule-based, с шаблонным
   evidence. Прогнать до трёх CSV.
4. `export_csv.py` + `run.py` — единая команда, замерить время (<5 минут).
5. `GET /graph` + базовый `GraphView.tsx` — убедиться, что граф визуализируется и не
   подвисает на 2248 узлах.
6. `TopList.tsx` + `NodeCard.tsx` + поиск по gid.
7. Только после того, как must-have работает end-to-end: `enrich_with_llm.py` (NVIDIA
   NIM) и `POST /assistant` (OpenAI) как опциональные надстройки, с fallback без них.
8. README.md.
