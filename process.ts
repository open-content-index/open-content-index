import { remark } from "remark";
import * as prettier from "prettier";

import * as fs from "node:fs/promises";

type YoutubePlaylist = {
  title: string;
  playlistId: string;
  content: Array<{
    videoId: string;
    title: string;
    publishedAt: string; // ISO-8601
    duration_s: number;
  }>;
};

async function main() {
  // This flow represents a change to the Markdown representation.
  const str = await fs.readFile(
    "./youtube/anjunadeep/The Anjunadeep Edition.md",
    "utf-8",
  );
  const ast = remark().parse(str);
  const youtubePlaylist = await parseYoutubePlaylist(ast);
  await fs.writeFile(
    "./youtube/anjunadeep/The Anjunadeep Edition.json",
    JSON.stringify(youtubePlaylist, null, 2),
  );
  const regeneratedMarkdown = generateMarkdown(youtubePlaylist);
  console.log(JSON.stringify(regeneratedMarkdown, null, 2));

  const markdownString = remark().stringify(regeneratedMarkdown as any);

  const formattedMarkdown = await prettier.format(markdownString, {
    parser: "markdown",
  });

  await fs.writeFile(
    "./youtube/anjunadeep/The Anjunadeep Edition.md",
    formattedMarkdown,
  );
}

function generateMarkdown(playlist: YoutubePlaylist) {
  return {
    type: "root" as const,
    children: [
      {
        type: "heading",
        depth: 1,
        children: [
          {
            type: "text",
            value: playlist.title,
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        start: null,
        spread: false,
        children: [
          {
            type: "listItem",
            spread: false,
            checked: null,
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    title: null,
                    url: `https://www.youtube.com/playlist?list=${playlist.playlistId}`,
                    children: [
                      {
                        type: "text",
                        value: "YouTube Playlist",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        depth: 2,
        children: [
          {
            type: "text",
            value: "Content",
          },
        ],
      },
      {
        type: "list",
        ordered: false,
        start: null,
        spread: false,
        children: playlist.content.map((item) => ({
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: `https://www.youtube.com/watch?v=${item.videoId}`,
                  children: [
                    {
                      type: "text",
                      value: item.title,
                    },
                  ],
                },
                {
                  type: "text",
                  value: generateTrailer(item.publishedAt, item.duration_s),
                },
              ],
            },
          ],
        })),
      },
    ],
  };
}

function generateTrailer(publishedAt: string, duration_s: number) {
  const date = new Date(publishedAt);
  const dateStr = date.toISOString().split("T")[0];
  const hours = Math.floor(duration_s / 3600);
  const minutes = Math.floor((duration_s % 3600) / 60);
  const seconds = duration_s % 60;
  return ` (${dateStr}) ${hours > 0 ? hours + ":" : ""}${String(
    minutes,
  ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const parse = remark().parse;

class Repeat {
  shape: unknown;

  constructor(shape: unknown) {
    this.shape = shape;
  }
}

function match(thing: unknown, path: string[], shape: unknown) {
  // console.debug("Matching", path.map((x) => "." + x).join(""), shape);
  try {
    if (typeof shape === "function") {
      if (shape.length !== 0) {
        throw new Error(`Captures must be functions with arity 0`);
      }
      // Ugh, complicated way to capture the name given it's DRY.
      const theCapture = (() => {
        const existing = captures.get(shape);
        if (existing) {
          return existing;
        }
        const theCaptureF = shape();
        const theCapture = theCaptureF(shape.name);
        if (!(theCapture instanceof Capture)) {
          throw new Error(`Capture functions must return a Capture`);
        }
        captures.set(shape, theCapture);
        return theCapture;
      })();

      theCapture.accept(thing);
      return;
    }

    if (
      typeof shape === "string" ||
      typeof shape === "number" ||
      typeof shape === "boolean"
    ) {
      if (thing !== shape) {
        throw new Error(`Expected ${shape}, got ${thing}`);
      }
      return;
    }

    if (Array.isArray(thing) && Array.isArray(shape)) {
      let idx = 0;
      for (const item of shape) {
        if (item instanceof Repeat) {
          while (idx < thing.length) {
            match(thing[idx], path.concat(String(idx)), item.shape);
            ++idx;
          }
        } else {
          match(thing[idx], path.concat(String(idx)), item);
          ++idx;
        }
      }
      return;
    }

    if (
      typeof thing === "object" &&
      thing !== null &&
      typeof shape === "object" &&
      shape !== null
    ) {
      for (const key in shape) {
        if (key in thing) {
          match((thing as any)[key], path.concat(key), (shape as any)[key]);
        }
      }
    }
  } catch (e) {
    throw new Error(`Error at ${JSON.stringify(path)}`, { cause: e });
  }
}

class Capture {
  name: Readonly<string>;
  value: unknown[] = [];

  constructor(name: string) {
    this.name = name;
  }

  accept(value: unknown) {
    this.value.push(value);
    return value;
  }
}

function capture(name: string) {
  return new Capture(name);
}

function repeat(shape: unknown) {
  return new Repeat(shape);
}

const captures = new WeakMap<Function, Capture>();

async function parseYoutubePlaylist(
  markdownRoot: ReturnType<typeof parse>,
): Promise<YoutubePlaylist> {
  // We need to pattern match on the AST, e.g. the EXAMPLE_AST.

  const $title = () => capture;
  const $playlistUrl = () => capture;
  const $contentItemUrl = () => capture;
  const $contentItemTitle = () => capture;
  const $contentItemTrailer = () => capture;

  match(markdownRoot, [], {
    type: "root",
    children: [
      {
        type: "heading",
        depth: 1,
        ordered: false,
        start: null,
        spread: false,
        children: [{ type: "text", value: $title }],
      },
      {
        type: "list",
        ordered: false,
        start: null,
        spread: false,
        children: [
          {
            type: "listItem",
            spread: false,
            checked: null,
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    title: null,
                    url: $playlistUrl,
                    children: [
                      {
                        type: "text",
                        value: "YouTube Playlist",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: "heading",
        depth: 2,
        children: [{ type: "text", value: "Content" }],
      },
      {
        type: "list",
        ordered: false,
        start: null,
        spread: false,
        children: [
          repeat({
            type: "listItem",
            spread: false,
            checked: null,
            children: [
              {
                type: "paragraph",
                children: [
                  {
                    type: "link",
                    title: null,
                    url: $contentItemUrl,
                    children: [
                      {
                        type: "text",
                        value: $contentItemTitle,
                      },
                    ],
                  },
                  {
                    type: "text",
                    value: $contentItemTrailer,
                  },
                ],
              },
            ],
          }),
        ],
      },
    ],
  });

  const ret: YoutubePlaylist = {
    title: captures.get($title)!.value[0] as string,
    playlistId: parsePlaylistIdFromUrl(
      captures.get($playlistUrl)!.value[0] as string,
    ),
    content: (captures.get($contentItemUrl)!.value as string[]).map(
      (url, idx) => ({
        videoId: parseVideoIdFromUrl(url),
        title: captures.get($contentItemTitle)!.value[idx] as string,
        ...parseTrailer(
          captures.get($contentItemTrailer)!.value[idx] as string,
        ),
      }),
    ),
  };

  return ret;
}

function parseVideoIdFromUrl(url: string) {
  const match = url.match(/^https:\/\/www\.youtube\.com\/watch\?v=([^&]+)$/);
  if (!match) {
    throw new Error(`Invalid YouTube URL: ${url}`);
  }
  return match[1];
}

function parsePlaylistIdFromUrl(url: string) {
  const match = url.match(
    /^https:\/\/www\.youtube\.com\/playlist\?list=([^&]+)$/,
  );
  if (!match) {
    throw new Error(`Invalid YouTube Playlist URL: ${url}`);
  }
  return match[1];
}

function parseTrailer(trailer: string) {
  const match = trailer.match(
    / \((\d{4}-\d{2}-\d{2})\) ((\d{1,2}):)?(\d{2}):(\d{2})/,
  );
  if (!match) {
    throw new Error(`Invalid trailer format: ${trailer}`);
  }
  const [, date, , hours, minutes, seconds] = match;
  return {
    publishedAt: date,
    duration_s:
      (hours ? Number(hours) : 0) * 3600 +
      Number(minutes) * 60 +
      Number(seconds),
  };
}

main();

const EXAMPLE_AST = {
  type: "root",
  children: [
    {
      type: "heading",
      depth: 1,
      children: [
        {
          type: "text",
          value: "The Anjunadeep Edition",
          position: {
            start: {
              line: 1,
              column: 3,
              offset: 2,
            },
            end: {
              line: 1,
              column: 25,
              offset: 24,
            },
          },
        },
      ],
      position: {
        start: {
          line: 1,
          column: 1,
          offset: 0,
        },
        end: {
          line: 1,
          column: 25,
          offset: 24,
        },
      },
    },
    {
      type: "list",
      ordered: false,
      start: null,
      spread: false,
      children: [
        {
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: "https://www.youtube.com/playlist?list=PLOftnzGIKwJB1h6ErEcFJTObuqqGNZPXI",
                  children: [
                    {
                      type: "text",
                      value: "YouTube Playlist",
                      position: {
                        start: {
                          line: 3,
                          column: 4,
                          offset: 29,
                        },
                        end: {
                          line: 3,
                          column: 20,
                          offset: 45,
                        },
                      },
                    },
                  ],
                  position: {
                    start: {
                      line: 3,
                      column: 3,
                      offset: 28,
                    },
                    end: {
                      line: 3,
                      column: 95,
                      offset: 120,
                    },
                  },
                },
              ],
              position: {
                start: {
                  line: 3,
                  column: 3,
                  offset: 28,
                },
                end: {
                  line: 3,
                  column: 95,
                  offset: 120,
                },
              },
            },
          ],
          position: {
            start: {
              line: 3,
              column: 1,
              offset: 26,
            },
            end: {
              line: 3,
              column: 95,
              offset: 120,
            },
          },
        },
      ],
      position: {
        start: {
          line: 3,
          column: 1,
          offset: 26,
        },
        end: {
          line: 3,
          column: 95,
          offset: 120,
        },
      },
    },
    {
      type: "heading",
      depth: 2,
      children: [
        {
          type: "text",
          value: "Content",
          position: {
            start: {
              line: 5,
              column: 4,
              offset: 125,
            },
            end: {
              line: 5,
              column: 11,
              offset: 132,
            },
          },
        },
      ],
      position: {
        start: {
          line: 5,
          column: 1,
          offset: 122,
        },
        end: {
          line: 5,
          column: 11,
          offset: 132,
        },
      },
    },
    {
      type: "list",
      ordered: false,
      start: null,
      spread: false,
      children: [
        {
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: "https://www.youtube.com/watch?v=3Sg6BJsAuf8",
                  children: [
                    {
                      type: "text",
                      value:
                        "The Anjunadeep Edition 584 with HANA b2b Dosem (Live at Explorations)",
                      position: {
                        start: {
                          line: 7,
                          column: 4,
                          offset: 137,
                        },
                        end: {
                          line: 7,
                          column: 73,
                          offset: 206,
                        },
                      },
                    },
                  ],
                  position: {
                    start: {
                      line: 7,
                      column: 3,
                      offset: 136,
                    },
                    end: {
                      line: 7,
                      column: 119,
                      offset: 252,
                    },
                  },
                },
                {
                  type: "text",
                  value: " (2026-02-26) 3:03:04",
                  position: {
                    start: {
                      line: 7,
                      column: 119,
                      offset: 252,
                    },
                    end: {
                      line: 7,
                      column: 140,
                      offset: 273,
                    },
                  },
                },
              ],
              position: {
                start: {
                  line: 7,
                  column: 3,
                  offset: 136,
                },
                end: {
                  line: 7,
                  column: 140,
                  offset: 273,
                },
              },
            },
          ],
          position: {
            start: {
              line: 7,
              column: 1,
              offset: 134,
            },
            end: {
              line: 7,
              column: 140,
              offset: 273,
            },
          },
        },
        {
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: "https://www.youtube.com/watch?v=iyXqeWRhjoU",
                  children: [
                    {
                      type: "text",
                      value: "The Anjunadeep Edition 582 with Noé Solange",
                      position: {
                        start: {
                          line: 8,
                          column: 4,
                          offset: 277,
                        },
                        end: {
                          line: 8,
                          column: 47,
                          offset: 320,
                        },
                      },
                    },
                  ],
                  position: {
                    start: {
                      line: 8,
                      column: 3,
                      offset: 276,
                    },
                    end: {
                      line: 8,
                      column: 93,
                      offset: 366,
                    },
                  },
                },
                {
                  type: "text",
                  value: " (2026-02-05) 1:00:49",
                  position: {
                    start: {
                      line: 8,
                      column: 93,
                      offset: 366,
                    },
                    end: {
                      line: 8,
                      column: 114,
                      offset: 387,
                    },
                  },
                },
              ],
              position: {
                start: {
                  line: 8,
                  column: 3,
                  offset: 276,
                },
                end: {
                  line: 8,
                  column: 114,
                  offset: 387,
                },
              },
            },
          ],
          position: {
            start: {
              line: 8,
              column: 1,
              offset: 274,
            },
            end: {
              line: 8,
              column: 114,
              offset: 387,
            },
          },
        },
        {
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: "https://www.youtube.com/watch?v=S-c3Ny89JzU",
                  children: [
                    {
                      type: "text",
                      value: "The Anjunadeep Edition 581 with Planet Of Souls",
                      position: {
                        start: {
                          line: 9,
                          column: 4,
                          offset: 391,
                        },
                        end: {
                          line: 9,
                          column: 51,
                          offset: 438,
                        },
                      },
                    },
                  ],
                  position: {
                    start: {
                      line: 9,
                      column: 3,
                      offset: 390,
                    },
                    end: {
                      line: 9,
                      column: 97,
                      offset: 484,
                    },
                  },
                },
                {
                  type: "text",
                  value: " (2026-01-29) 1:02:54",
                  position: {
                    start: {
                      line: 9,
                      column: 97,
                      offset: 484,
                    },
                    end: {
                      line: 9,
                      column: 118,
                      offset: 505,
                    },
                  },
                },
              ],
              position: {
                start: {
                  line: 9,
                  column: 3,
                  offset: 390,
                },
                end: {
                  line: 9,
                  column: 118,
                  offset: 505,
                },
              },
            },
          ],
          position: {
            start: {
              line: 9,
              column: 1,
              offset: 388,
            },
            end: {
              line: 9,
              column: 118,
              offset: 505,
            },
          },
        },
        {
          type: "listItem",
          spread: false,
          checked: null,
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  title: null,
                  url: "https://www.youtube.com/watch?v=TLyyLVaJvJg",
                  children: [
                    {
                      type: "text",
                      value:
                        "The Anjunadeep Edition 580 with OLING and Viggo Dyst",
                      position: {
                        start: {
                          line: 10,
                          column: 4,
                          offset: 509,
                        },
                        end: {
                          line: 10,
                          column: 56,
                          offset: 561,
                        },
                      },
                    },
                  ],
                  position: {
                    start: {
                      line: 10,
                      column: 3,
                      offset: 508,
                    },
                    end: {
                      line: 10,
                      column: 102,
                      offset: 607,
                    },
                  },
                },
                {
                  type: "text",
                  value: " (2026-01-22) 57:49",
                  position: {
                    start: {
                      line: 10,
                      column: 102,
                      offset: 607,
                    },
                    end: {
                      line: 10,
                      column: 121,
                      offset: 626,
                    },
                  },
                },
              ],
              position: {
                start: {
                  line: 10,
                  column: 3,
                  offset: 508,
                },
                end: {
                  line: 10,
                  column: 121,
                  offset: 626,
                },
              },
            },
          ],
          position: {
            start: {
              line: 10,
              column: 1,
              offset: 506,
            },
            end: {
              line: 10,
              column: 121,
              offset: 626,
            },
          },
        },
      ],
      position: {
        start: {
          line: 7,
          column: 1,
          offset: 134,
        },
        end: {
          line: 10,
          column: 121,
          offset: 626,
        },
      },
    },
  ],
  position: {
    start: {
      line: 1,
      column: 1,
      offset: 0,
    },
    end: {
      line: 11,
      column: 1,
      offset: 627,
    },
  },
};
