# Sunday 22 November 2026: 35 stories — Gulf on edge, Trump–Xi–Putin summit, EU arms Ukraine €1bn

[![make.fun](https://img.shields.io/badge/make.fun-news--image--20261122-red)](https://make.fun/c/news-image-20261122)

A make.fun entry for **news-image-20261122** — "Sum up 22 November's world news in one image".
The program draws a one-page newspaper front page of Sunday 22 November 2026:
3 lead stories + 10 small stories (all with original flat illustrations), a world map
with numbered pins, a 22-item "ALSO ON SUNDAY 22 NOVEMBER" list, a 6-number stat
strip, a region bar, and a DATE CHECK box listing the 20/21 November stories that
were deliberately left out. 35 stories in total, every one dated 22 November 2026,
each with its source named beside it.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Node 22+, standard library only — no network, no assets, no randomness.
Two runs write byte-identical output: a 1024×1024 PNG at `/output/entry.png`
(or `$MAKEFUN_OUTPUT_DIR/entry.png`), under 1 MiB.

## How it works

`main.ts` is a small software rasterizer written from scratch: a hand-written
5×7 bitmap font, filled shapes (rects, lines, discs, triangles, polygons),
flat original illustrations for each featured story, a schematic world map,
and a minimal PNG encoder (zlib deflate from the Node standard library).

## License

MIT — see [LICENSE](LICENSE).
