// Run with the Figma `use_figma` MCP tool against the Transcriber Figma file.
// Required skillNames: "figma-use,figma-generate-library"
//
// This script creates or updates local Figma color variables for the
// Transcriber design system. Values map to design-system/tokens/colors.css.

const COLLECTION_NAME = "Transcriber / Color";

const colorSpecs = [
  { name: "bg", css: "--ds-color-bg", value: hex("#0a0a0a"), scopes: ["FRAME_FILL", "SHAPE_FILL"] },
  { name: "panel", css: "--ds-color-panel", value: hex("#121212"), scopes: ["FRAME_FILL", "SHAPE_FILL"] },
  { name: "panel-2", css: "--ds-color-panel-2", value: hex("#171717"), scopes: ["FRAME_FILL", "SHAPE_FILL"] },
  { name: "border", css: "--ds-color-border", value: hex("#242424"), scopes: ["STROKE_COLOR"] },
  { name: "border-hover", css: "--ds-color-border-hover", value: rgba(255, 255, 255, 0.30), scopes: ["STROKE_COLOR"] },
  { name: "text", css: "--ds-color-text", value: hex("#fafafa"), scopes: ["TEXT_FILL"] },
  { name: "muted", css: "--ds-color-muted", value: hex("#b3b3b3"), scopes: ["TEXT_FILL"] },
  { name: "muted-2", css: "--ds-color-muted-2", value: hex("#8c8c8c"), scopes: ["TEXT_FILL"] },
  { name: "muted-3", css: "--ds-color-muted-3", value: hex("#666666"), scopes: ["TEXT_FILL"] },
  { name: "accent", css: "--ds-color-accent", value: hex("#a58959"), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  { name: "destructive", css: "--ds-color-destructive", value: rgba(239, 68, 68, 0.80), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  { name: "error", css: "--ds-color-error", value: hex("#f87171"), scopes: ["TEXT_FILL", "STROKE_COLOR"] },
  { name: "success", css: "--ds-color-success", value: hex("#a58959"), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  { name: "white/5", css: "--ds-color-white-5", value: rgba(255, 255, 255, 0.05), scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"] },
  { name: "white/10", css: "--ds-color-white-10", value: rgba(255, 255, 255, 0.10), scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"] },
  { name: "white/15", css: "--ds-color-white-15", value: rgba(255, 255, 255, 0.15), scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"] },
  { name: "white/20", css: "--ds-color-white-20", value: rgba(255, 255, 255, 0.20), scopes: ["FRAME_FILL", "SHAPE_FILL", "STROKE_COLOR"] },
  { name: "white/60", css: "--ds-color-white-60", value: rgba(255, 255, 255, 0.60), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  { name: "white/80", css: "--ds-color-white-80", value: rgba(255, 255, 255, 0.80), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
  { name: "white/90", css: "--ds-color-white-90", value: rgba(255, 255, 255, 0.90), scopes: ["FRAME_FILL", "SHAPE_FILL", "TEXT_FILL", "STROKE_COLOR"] },
];

function hex(input) {
  const raw = input.replace("#", "");
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  return { r, g, b, a: 1 };
}

function rgba(r, g, b, a) {
  return { r: r / 255, g: g / 255, b: b / 255, a };
}

const collections = await figma.variables.getLocalVariableCollectionsAsync();
let collection = collections.find((item) => item.name === COLLECTION_NAME);
const createdCollection = !collection;

if (!collection) {
  collection = figma.variables.createVariableCollection(COLLECTION_NAME);
}

const modeId = collection.modes[0].modeId;
if (collection.modes[0].name !== "Default") {
  collection.renameMode(modeId, "Default");
}

const localVariables = await figma.variables.getLocalVariablesAsync("COLOR");
const collectionVariables = localVariables.filter(
  (variable) => variable.variableCollectionId === collection.id,
);

const createdVariableIds = [];
const updatedVariableIds = [];

for (const spec of colorSpecs) {
  let variable = collectionVariables.find((item) => item.name === spec.name);
  const existed = Boolean(variable);

  if (!variable) {
    variable = figma.variables.createVariable(spec.name, collection, "COLOR");
  }

  variable.description = `Maps to ${spec.css} in design-system/tokens/colors.css.`;
  variable.scopes = spec.scopes;
  variable.setValueForMode(modeId, spec.value);
  variable.setVariableCodeSyntax("WEB", `var(${spec.css})`);

  if (existed) {
    updatedVariableIds.push(variable.id);
  } else {
    createdVariableIds.push(variable.id);
  }
}

return {
  collectionId: collection.id,
  createdCollection,
  createdVariableIds,
  updatedVariableIds,
  variables: colorSpecs.map((spec) => spec.name),
};
