export type ReviewStatus = "confirmed" | "needs_review" | "rejected";
export type StudyAssetType = "comprehensive_guide"|"weekly_summary"|"glossary"|"flashcards"|"practice_quiz"|"practice_exam"|"reading_brief"|"lecture_outline"|"concept_map"|"formula_sheet"|"assignment_planner"|"final_exam_pack";
export interface SourceLocation {page_number?:number;slide_number?:number;sheet_name?:string;cell_range?:string;start_seconds?:number;end_seconds?:number}
export interface Citation {id:string;document_id:string;quote:string;status:ReviewStatus;location:SourceLocation}
