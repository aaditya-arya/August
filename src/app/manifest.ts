import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "August - One Inbox",
    short_name: "One Inbox",
    description: "AI-powered second brain, NLP note routing, and knowledge graph.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdfbfb",
    theme_color: "#ec4899",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    // Web Share Target API: registers 'One Inbox' in native OS share sheet (Notion, Safari, Twitter, Notes)
    share_target: {
      action: "/api/share-target",
      method: "POST",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    } as any,
  };
}
