const platforms = [
  {
    id: "amazon",
    name: "Amazon",
    heroRatio: "1:1",
    imageSize: "2000x2000",
    mainImageRules: ["white background", "product fills 85% of frame", "no badges on main image"],
    secondaryImageRules: ["lifestyle context allowed", "benefit callouts allowed", "dimension image allowed"],
    textSafeArea: "secondary images only"
  },
  {
    id: "temu",
    name: "Temu",
    heroRatio: "1:1",
    imageSize: "2000x2000",
    mainImageRules: ["clean product focus", "high contrast", "clear value proposition"],
    secondaryImageRules: ["scenario image", "feature image", "bundle or scale image"],
    textSafeArea: "avoid clutter near product center"
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    heroRatio: "4:5",
    imageSize: "1440x1800",
    mainImageRules: ["mobile-first composition", "fast visual hook", "human or use-case context preferred"],
    secondaryImageRules: ["ugc-style scene", "benefit callout", "before-after if truthful"],
    textSafeArea: "top and bottom safe zones"
  },
  {
    id: "etsy",
    name: "Etsy",
    heroRatio: "4:3",
    imageSize: "2000x1500",
    mainImageRules: ["crafted feel", "natural light", "clear handmade or premium cue"],
    secondaryImageRules: ["detail texture", "scale context", "giftable scene"],
    textSafeArea: "minimal text preferred"
  }
];

function getPlatform(id) {
  const platform = platforms.find((item) => item.id === id);
  if (!platform) throw new Error(`Unknown platform: ${id}`);
  return platform;
}

module.exports = { platforms, getPlatform };
