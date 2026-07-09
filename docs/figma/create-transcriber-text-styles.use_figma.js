// Run with the Figma `use_figma` MCP tool against the Transcriber Figma file.
// Required skillNames: "figma-use,figma-generate-library"
//
// This script creates or updates local Figma text styles for the Transcriber
// design system. It is intentionally idempotent: re-running it updates existing
// styles by name instead of duplicating them.

const STYLE_NAMESPACE = "Type";

const styleSpecs = [
  {
    name: `${STYLE_NAMESPACE}/Heading`,
    family: "Geist",
    style: "SemiBold",
    fontSize: 22,
    lineHeightPx: 28,
    letterSpacingPercent: 0,
    description: "Primary operational heading. Maps to --text-heading-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/List title`,
    family: "Geist",
    style: "Medium",
    fontSize: 16,
    lineHeightPx: 22,
    letterSpacingPercent: 0,
    description: "Recent-list and compact item title. Maps to --text-list-title-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Panel title`,
    family: "Geist",
    style: "SemiBold",
    fontSize: 15,
    lineHeightPx: 20,
    letterSpacingPercent: 0,
    description: "Extension panel and state title. Maps to --text-panel-title-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Body`,
    family: "Geist",
    style: "Regular",
    fontSize: 14,
    lineHeightPx: 20,
    letterSpacingPercent: 0,
    description: "Default body, input, and medium button text. Maps to --text-body-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Button`,
    family: "Geist",
    style: "Medium",
    fontSize: 14,
    lineHeightPx: 20,
    letterSpacingPercent: 0,
    description: "Primary and medium button text. Maps to .btn-transcribe.",
  },
  {
    name: `${STYLE_NAMESPACE}/Row title`,
    family: "Geist",
    style: "Medium",
    fontSize: 13,
    lineHeightPx: 18,
    letterSpacingPercent: 0,
    description: "Dense extension row title. Maps to --text-row-title-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Button SM + Meta`,
    family: "Geist",
    style: "Medium",
    fontSize: 12,
    lineHeightPx: 16,
    letterSpacingPercent: 0,
    description: "Small buttons and metadata. Maps to --text-caption-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Status label`,
    family: "Geist",
    style: "Medium",
    fontSize: 11,
    lineHeightPx: 14,
    letterSpacingPercent: 8,
    description: "Uppercase status and section labels. Maps to --text-label-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Micro label`,
    family: "Geist",
    style: "Medium",
    fontSize: 10,
    lineHeightPx: 13,
    letterSpacingPercent: 8,
    description: "Small uppercase labels. Maps to --text-micro-size.",
  },
  {
    name: `${STYLE_NAMESPACE}/Timestamp`,
    family: "Geist Mono",
    style: "Regular",
    fontSize: 12,
    lineHeightPx: 18,
    letterSpacingPercent: 0,
    description: "Transcript timestamps and technical metadata. Maps to --font-mono.",
  },
];

const availableFonts = await figma.listAvailableFontsAsync();

function resolveFont(family, style) {
  const exact = availableFonts.find(
    (font) => font.fontName.family === family && font.fontName.style === style,
  );
  if (exact) return exact.fontName;

  const sameFamily = availableFonts.find((font) => font.fontName.family === family);
  if (sameFamily) return sameFamily.fontName;

  const interFallback = availableFonts.find(
    (font) => font.fontName.family === "Inter" && font.fontName.style === style,
  );
  if (interFallback) return interFallback.fontName;

  const anyInter = availableFonts.find((font) => font.fontName.family === "Inter");
  if (anyInter) return anyInter.fontName;

  throw new Error(`No usable font found for ${family} ${style}`);
}

const localTextStyles = await figma.getLocalTextStylesAsync();
const createdStyleIds = [];
const updatedStyleIds = [];
const fontFallbacks = [];

for (const spec of styleSpecs) {
  const fontName = resolveFont(spec.family, spec.style);
  await figma.loadFontAsync(fontName);

  if (fontName.family !== spec.family || fontName.style !== spec.style) {
    fontFallbacks.push({
      style: spec.name,
      requested: `${spec.family} ${spec.style}`,
      used: `${fontName.family} ${fontName.style}`,
    });
  }

  let textStyle = localTextStyles.find((style) => style.name === spec.name);
  const existed = Boolean(textStyle);

  if (!textStyle) {
    textStyle = figma.createTextStyle();
    textStyle.name = spec.name;
  }

  textStyle.fontName = fontName;
  textStyle.fontSize = spec.fontSize;
  textStyle.lineHeight = { unit: "PIXELS", value: spec.lineHeightPx };
  textStyle.letterSpacing = { unit: "PERCENT", value: spec.letterSpacingPercent };
  textStyle.paragraphSpacing = 0;
  textStyle.description = spec.description;

  if (existed) {
    updatedStyleIds.push(textStyle.id);
  } else {
    createdStyleIds.push(textStyle.id);
  }
}

return {
  createdStyleIds,
  updatedStyleIds,
  styles: styleSpecs.map((spec) => spec.name),
  fontFallbacks,
};
