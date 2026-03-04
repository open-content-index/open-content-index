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
  const url = process.argv[2];
  if (!url) {
    console.error(
      "Usage: npx tsx fetch-playlist.ts <youtube-playlist-url>\n" +
        "Example: npx tsx fetch-playlist.ts https://www.youtube.com/playlist?list=PLOftnzGIKwJB1h6ErEcFJTObuqqGNZPXI\n\n" +
        "Requires YOUTUBE_API_KEY environment variable.",
    );
    process.exit(1);
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error(
      "Error: YOUTUBE_API_KEY environment variable is required.\n" +
        "Get an API key from https://console.cloud.google.com/apis/credentials",
    );
    process.exit(1);
  }

  const playlistId = parsePlaylistIdFromUrl(url);
  const playlist = await fetchPlaylist(apiKey, playlistId);

  const outputPath = process.argv[3];
  const json = JSON.stringify(playlist, null, 2);

  if (outputPath) {
    await fs.writeFile(outputPath, json + "\n");
    console.error(`Written to ${outputPath}`);
  } else {
    console.log(json);
  }
}

export function parsePlaylistIdFromUrl(url: string): string {
  const match = url.match(
    /^https:\/\/www\.youtube\.com\/playlist\?list=([^&]+)$/,
  );
  if (!match) {
    throw new Error(`Invalid YouTube Playlist URL: ${url}`);
  }
  return match[1];
}

async function fetchPlaylist(
  apiKey: string,
  playlistId: string,
): Promise<YoutubePlaylist> {
  const title = await fetchPlaylistTitle(apiKey, playlistId);
  const items = await fetchAllPlaylistItems(apiKey, playlistId);

  const videoIds = items.map((item) => item.videoId);
  const videoDetails = await fetchVideoDetails(apiKey, videoIds);

  const content = items
    .map((item) => {
      const details = videoDetails.get(item.videoId);
      if (!details) return null;
      return {
        videoId: item.videoId,
        title: item.title,
        publishedAt: details.publishedAt,
        duration_s: details.duration_s,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { title, playlistId, content };
}

async function fetchPlaylistTitle(
  apiKey: string,
  playlistId: string,
): Promise<string> {
  const url = new URL("https://www.googleapis.com/youtube/v3/playlists");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("id", playlistId);
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(
      `YouTube API error (playlists.list): ${res.status} ${res.statusText}`,
    );
  }
  const data = await res.json();
  if (!data.items || data.items.length === 0) {
    throw new Error(`Playlist not found: ${playlistId}`);
  }
  return data.items[0].snippet.title;
}

type PlaylistItem = { videoId: string; title: string };

async function fetchAllPlaylistItems(
  apiKey: string,
  playlistId: string,
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems",
    );
    url.searchParams.set("part", "snippet");
    url.searchParams.set("playlistId", playlistId);
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("key", apiKey);
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(
        `YouTube API error (playlistItems.list): ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const videoId = item.snippet?.resourceId?.videoId;
      const title = item.snippet?.title;
      if (videoId && title) {
        items.push({ videoId, title });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return items;
}

async function fetchVideoDetails(
  apiKey: string,
  videoIds: string[],
): Promise<Map<string, { publishedAt: string; duration_s: number }>> {
  const details = new Map<
    string,
    { publishedAt: string; duration_s: number }
  >();

  // YouTube API allows up to 50 IDs per request
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "snippet,contentDetails");
    url.searchParams.set("id", batch.join(","));
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(
        `YouTube API error (videos.list): ${res.status} ${res.statusText}`,
      );
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const publishedAt = item.snippet?.publishedAt;
      const duration = item.contentDetails?.duration;
      if (publishedAt && duration) {
        details.set(item.id, {
          publishedAt: publishedAt.split("T")[0],
          duration_s: parseISO8601Duration(duration),
        });
      }
    }
  }

  return details;
}

export function parseISO8601Duration(duration: string): number {
  const match = duration.match(
    /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/,
  );
  if (!match) {
    throw new Error(`Invalid ISO 8601 duration: ${duration}`);
  }
  const [, hours, minutes, seconds] = match;
  return (
    (hours ? Number(hours) : 0) * 3600 +
    (minutes ? Number(minutes) : 0) * 60 +
    (seconds ? Number(seconds) : 0)
  );
}

// Run main() only when executed directly, not when imported
const isDirectRun =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
  main();
}
