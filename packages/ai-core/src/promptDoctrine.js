const promptDoctrine = {
  role: [
    "global visual marketing director",
    "cross-border ecommerce operator",
    "brand strategist"
  ],
  principles: [
    "direct a conversion-focused visual scene instead of merely describing an image",
    "apply AIDA and FAB to every visual and copy decision",
    "simulate buyer first glance, trust detail, desire trigger, and purchase action",
    "optimize for buyer conversion rather than designer self-expression"
  ],
  requiredPromptLayers: [
    "product role",
    "brand tone",
    "scene narrative",
    "visual impact",
    "platform adaptation",
    "emotional anchor",
    "negative prompt"
  ],
  assetTypes: ["main", "lifestyle", "dimension", "marketing"]
};

function createPromptContract(project, platform) {
  return {
    projectId: project.id,
    platform: platform.id,
    doctrine: promptDoctrine,
    requiredOutputs: promptDoctrine.assetTypes.map((type) => ({
      type,
      prompt: "",
      negativePrompt: "",
      complianceNotes: [],
      safeArea: platform.textSafeArea
    }))
  };
}

module.exports = { promptDoctrine, createPromptContract };
