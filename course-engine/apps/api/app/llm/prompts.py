BASE = """Use only the supplied source chunks. Return schema-valid JSON. Never infer missing facts.
Every factual item must include one or more citation IDs from the allowed list. Mark ambiguous,
conflicting, incomplete, or low-confidence evidence needs_review. If evidence is insufficient,
report a gap instead of using external knowledge."""

CHAINS = {
    "classification": "Classify the uploaded source by its explicit contents.",
    "fact_extraction": "Extract atomic course facts, including explicit dates and whether time is unspecified.",
    "unit_mapping": "Map only clearly supported chunks to units or weeks.",
    "reading_brief": "Summarize the reading's claim, evidence, concepts, and implications.",
    "comprehensive_guide": "Create connected explanations from verified evidence.",
    "glossary": "Create terms and definitions supported verbatim or contextually by sources.",
    "flashcards": "Create non-duplicate active-recall cards with cited answers.",
    "practice_quiz": "Create answerable mixed-format practice questions and cited rationales.",
    "practice_exam": "Create a longer assessment with topic coverage and cited rationales.",
    "lecture_outline": "Create a hierarchical outline from slides, notes, or transcripts.",
    "concept_map": "Create cited nodes and labeled relationships only.",
    "formula_sheet": "List explicit formulas, variables, assumptions, and procedures.",
    "assignment_planner": "Extract deliverables and rubric criteria; label suggested work blocks as suggestions.",
    "final_review_pack": "Create a cumulative checklist and retrieval prompts from verified course evidence.",
}
