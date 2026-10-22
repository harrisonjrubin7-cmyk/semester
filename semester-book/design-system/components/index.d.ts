// Types for every component in window.SemesterDesignSystem_e9f3ba, gathered from components/<Name>/<Name>.d.ts.

// ---- AIResponse
import * as React from 'react';
/**
 * A governed assistant answer — labelled AI-assisted with data scope, numbered sources, confidence, request cost and policy.
 * @startingPoint section="AI" subtitle="A governed assistant answer — labelled AI-assisted with data scope, numbered sou" viewport="700x400"
 */
export interface AIResponseProps { children: React.ReactNode; scope?: string[]; sources?: { title: string; kind?: string }[]; confidence?: string; cost?: string; policy?: string; actions?: React.ReactNode; model?: string; }
export declare function AIResponse(props: AIResponseProps): JSX.Element;

// ---- ActionPreview
import * as React from 'react';
/**
 * What is about to happen, said before it happens — What happens / Exactly what / What stays / Taking it back.
 */
export interface ActionPreviewProps { subject?: string; says: React.ReactNode; exactly?: React.ReactNode; doesNotChange?: React.ReactNode; recovery: { kind: "undo" | "request" | "none"; how?: string }; subjectTo?: React.ReactNode; provenance?: React.ReactNode; }
export declare function ActionPreview(props: ActionPreviewProps): JSX.Element;

// ---- ApprovalBanner
import * as React from 'react';
export interface ApprovalBannerProps { state?: "required" | "pending" | "approved" | "rejected"; what: string; approver?: string; requestedBy?: string; onRequest?: () => void; onApprove?: () => void; onReject?: () => void; }
export declare function ApprovalBanner(props: ApprovalBannerProps): JSX.Element;

// ---- Avatar
import * as React from 'react';
/** Initials in a tinted square that follows the corner setting; profile glyph when no name. */
export interface AvatarProps { name?: string; size?: number; }
export declare function Avatar(props: AvatarProps): JSX.Element;

// ---- Button
import * as React from 'react';
/**
 * Action button — one primary per decision region; 44px tall by default, condensed-caps-free label in Barlow Condensed 600.
 * @startingPoint section="Actions" subtitle="Action button — one primary per decision region; 44px tall by default, condensed" viewport="700x400"
 */
export interface ButtonProps { variant?: "primary" | "secondary" | "ghost" | "danger"; size?: "md" | "sm"; icon?: string; iconAfter?: string; block?: boolean; loading?: boolean; disabled?: boolean; children?: React.ReactNode; onClick?: (e: any) => void; type?: "button" | "submit"; }
export declare function Button(props: ButtonProps): JSX.Element;

// ---- Choice
import * as React from 'react';
/**
 * Radio/checkbox row with a sentence explaining the consequence — used for visibility and sharing choices.
 */
export interface ChoiceProps { type?: "radio" | "checkbox"; label: string; about?: string; checked?: boolean; onChange?: (e: any) => void; name?: string; value?: string; disabled?: boolean; }
export declare function Choice(props: ChoiceProps): JSX.Element;

// ---- Combobox
import * as React from 'react';
/** Text box with a filtered listbox beneath — course search, people, rooms. */
export interface ComboboxProps { label: string; hint?: string; options: { label: string; detail?: string }[]; value?: string; onChange?: (q: string) => void; onSelect?: (o: any) => void; placeholder?: string; defaultOpen?: boolean; }
export declare function Combobox(props: ComboboxProps): JSX.Element;

// ---- CommandPalette
import * as React from 'react';
/**
 * Global search and command palette (⌘K) with keyboard selection.
 */
export interface CommandPaletteProps { groups: { label: string; items: { label: string; icon?: string; detail?: string }[] }[]; placeholder?: string; onSelect?: (item: any) => void; }
export declare function CommandPalette(props: CommandPaletteProps): JSX.Element;

// ---- ConsentBadge
import * as React from 'react';
export interface ConsentBadgeProps { state?: "private" | "shared" | "expired" | "revoked" | "required"; recipient?: string; expires?: string; onManage?: () => void; }
export declare function ConsentBadge(props: ConsentBadgeProps): JSX.Element;

// ---- ContextBar
import * as React from 'react';
/**
 * The object a screen is about, with its states and actions.
 */
export interface ContextBarProps { kicker?: string; title: string; states?: React.ReactNode; actions?: React.ReactNode; }
export declare function ContextBar(props: ContextBarProps): JSX.Element;

// ---- DataTable
import * as React from 'react';
/**
 * Crisp comparison table with caps headers, hairline rows, tabular numerals.
 * @startingPoint section="Data" subtitle="Crisp comparison table with caps headers, hairline rows, tabular numerals." viewport="700x400"
 */
export interface DataTableProps { columns: { key: string; label: string; numeric?: boolean; render?: (row: any) => React.ReactNode }[]; rows: any[]; caption?: string; }
export declare function DataTable(props: DataTableProps): JSX.Element;

// ---- DateField
import * as React from 'react';
/** Native date/time input with the chosen date spoken back unambiguously. */
export interface DateFieldProps { label: string; hint?: string; value?: string; onChange?: (e: any) => void; withTime?: boolean; said?: string; }
export declare function DateField(props: DateFieldProps): JSX.Element;

// ---- DecisionTrail
import * as React from 'react';
/**
 * Auditable timeline of who did what, when, and under which authority.
 */
export interface DecisionTrailProps { items: { title: string; who?: string; when?: string; detail?: string; state?: "done" | "current" | "waiting" | "blocked" }[]; label?: string; }
export declare function DecisionTrail(props: DecisionTrailProps): JSX.Element;

// ---- Dialog
import * as React from 'react';
/**
 * Modal confirmation — focus lands on Cancel, Escape closes, names object + consequence + recovery.
 */
export interface DialogProps { open?: boolean; title: string; children?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; onConfirm?: () => void; onCancel?: () => void; destructive?: boolean; inline?: boolean; }
export declare function Dialog(props: DialogProps): JSX.Element;

// ---- EmptyState
import * as React from 'react';
/**
 * Explains why a list is empty and offers one relevant next action.
 * @startingPoint section="States" subtitle="Explains why a list is empty and offers one relevant next action." viewport="700x400"
 */
export interface EmptyStateProps { title: string; body?: string; action?: React.ReactNode; }
export declare function EmptyState(props: EmptyStateProps): JSX.Element;

// ---- ErrorState
import * as React from 'react';
/**
 * Plain-language failure with a required recovery action and an optional support reference.
 */
export interface ErrorStateProps { title: string; body: string; recoverLabel?: string; onRecover?: () => void; secondaryLabel?: string; onSecondary?: () => void; reference?: string; }
export declare function ErrorState(props: ErrorStateProps): JSX.Element;

// ---- ErrorSummary
import * as React from 'react';
export interface ErrorSummaryProps { errors: { field: string; message: string }[]; title?: string; }
export declare const ErrorSummary: (props: ErrorSummaryProps & { ref?: any }) => JSX.Element | null;

// ---- Fields
import * as React from 'react';
/**
 * Label/value definition list for records and context.
 */
export interface FieldsProps { items: { field: string; value: React.ReactNode; mono?: boolean }[]; label?: string; }
export declare function Fields(props: FieldsProps): JSX.Element;

// ---- FocusBar
import * as React from 'react';
/** Floating pill during a focus session: time left, task, Pause, End. */
export interface FocusBarProps { task: string; remaining?: string; onPause?: () => void; onEnd?: () => void; breakDue?: string; }
export declare function FocusBar(props: FocusBarProps): JSX.Element;

// ---- HealthBadge
import * as React from 'react';
export interface HealthBadgeProps { band?: "healthy" | "watch" | "atrisk" | "unknown"; score?: number; driver?: string; updated?: string; }
export declare function HealthBadge(props: HealthBadgeProps): JSX.Element;

// ---- Icon
import * as React from 'react';
/**
 * Semester line glyph (Lucide-like, 24 grid, 1.5 stroke) from the app's own icon set — 108 names, see assets/icons/.
 * @startingPoint section="Glyph" subtitle="Semester line glyph (Lucide-like, 24 grid, 1.5 stroke) from the app's own icon s" viewport="700x400"
 */
export interface IconProps { name: string; size?: number; label?: string; strokeWidth?: number; style?: React.CSSProperties; className?: string; }
export declare function Icon(props: IconProps): JSX.Element;
export declare const ICON_NAMES: string[];

// ---- IconButton
import * as React from 'react';
/**
 * Icon-only control with a required accessible name (also its tooltip).
 */
export interface IconButtonProps { icon: string; label: string; size?: "md" | "sm"; pressed?: boolean; onClick?: (e: any) => void; }
export declare function IconButton(props: IconButtonProps): JSX.Element;

// ---- LoadingState
import * as React from 'react';
/**
 * Still structural placeholders plus a spoken "Loading …" — no spinner or shimmer.
 */
export interface LoadingStateProps { what?: string; bars?: number[]; }
export declare function LoadingState(props: LoadingStateProps): JSX.Element;

// ---- MetricTile
import * as React from 'react';
/** One figure worth reading first, with unit, source and age. */
export interface MetricTileProps { label: string; value: string; unit?: string; source?: string; updated?: string; delta?: string; }
export declare function MetricTile(props: MetricTileProps): JSX.Element;

// ---- NextSteps
import * as React from 'react';
/**
 * Ordered list of next safe actions, each with one line of why.
 */
export interface NextStepsProps { steps: { label: string; why?: string; icon?: string; aside?: React.ReactNode; onClick?: () => void }[]; }
export declare function NextSteps(props: NextStepsProps): JSX.Element;

// ---- Notice
import * as React from 'react';
/**
 * One-line service or context notice (role=status).
 */
export interface NoticeProps { head?: string; children: React.ReactNode; }
export declare function Notice(props: NoticeProps): JSX.Element;

// ---- ObjectCard
import * as React from 'react';
/**
 * The universal decision card: eyebrow → title → provenance → why → metadata → one primary + one quiet secondary.
 * @startingPoint section="Surfaces" subtitle="The universal decision card: eyebrow → title → provenance → why → metadata → one" viewport="700x400"
 */
export interface ObjectCardProps { kind?: string; statuses?: string[]; title: string; provenance?: { origin: string; by?: string; cues?: string[]; age?: string }; explanation?: string; metadata?: string; primary?: { label: string; onClick?: () => void }; secondary?: { label: string; onClick?: () => void }; tone?: "pending" | "danger"; level?: 2 | 3 | 4; children?: React.ReactNode; }
export declare function ObjectCard(props: ObjectCardProps): JSX.Element;

// ---- OfflineStrip
import * as React from 'react';
/**
 * Offline strip that says what still works and that changes are queued.
 */
export interface OfflineStripProps { queued?: number; syncs?: boolean; }
export declare function OfflineStrip(props: OfflineStripProps): JSX.Element;

// ---- OpenIn
import * as React from 'react';
/** "Open in" row — the way from one object to every place it matters (Plan, Study, Calendar). */
export interface OpenInProps { targets: string[]; about: string; onOpen?: (t: string) => void; }
export declare function OpenIn(props: OpenInProps): JSX.Element;

// ---- PageHeader
import * as React from 'react';
export interface PageHeaderProps { kicker?: string; title: string; purpose?: string; source?: React.ReactNode; actions?: React.ReactNode; }
export declare function PageHeader(props: PageHeaderProps): JSX.Element;

// ---- PermissionNotice
import * as React from 'react';
/**
 * States what changed about access, why, and where it is controlled.
 */
export interface PermissionNoticeProps { changed: string; why: string; controlLabel?: string; onControl?: () => void; }
export declare function PermissionNotice(props: PermissionNoticeProps): JSX.Element;

// ---- PolicyBadge
import * as React from 'react';
export interface PolicyBadgeProps { name: string; version?: string; owner?: string; onOpen?: () => void; }
export declare function PolicyBadge(props: PolicyBadgeProps): JSX.Element;

// ---- ProgressState
import * as React from 'react';
/**
 * A determinate wait (upload, import) with real <progress>, percentage in words, Cancel/Retry.
 */
export interface ProgressStateProps { label: string; done?: number; total?: number; note?: string; failed?: string; onCancel?: () => void; onRetry?: () => void; }
export declare function ProgressState(props: ProgressStateProps): JSX.Element;

// ---- ProvenanceChart
import * as React from 'react';
/** Bar chart that encodes provenance: solid official/connected, outline yours, hatched estimated/AI, dotted stale. */
export interface ProvenanceChartProps { title: string; rows: { label: string; value: number; source?: string }[]; unit?: string; max?: number; source?: string; demo?: boolean; }
export declare function ProvenanceChart(props: ProvenanceChartProps): JSX.Element;

// ---- ProvenanceChips
import * as React from 'react';
/**
 * A fact's origin chip plus at most two cues and its age, spoken as one sentence.
 */
export interface ProvenanceChipsProps { origin: string; by?: string; cues?: string[]; age?: string; }
export declare function ProvenanceChips(props: ProvenanceChipsProps): JSX.Element;

// ---- QuickActions
import * as React from 'react';
/** Row of 2–5 labelled starting actions for empty and onboarding states. */
export interface QuickActionsProps { actions: { label: string; icon?: string; onClick?: () => void }[]; }
export declare function QuickActions(props: QuickActionsProps): JSX.Element;

// ---- SaveState
import * as React from 'react';
/**
 * The quiet "Saving… → Saved" line near the work, in a polite live region.
 */
export interface SaveStateProps { status?: string; }
export declare function SaveState(props: SaveStateProps): JSX.Element;

// ---- ScreenGuide
import * as React from 'react';
/** "About this screen" disclosure at the foot of every screen — what it is for, where its data comes from, who decides. */
export interface ScreenGuideProps { items: { q: string; a: string }[]; open?: boolean; }
export declare function ScreenGuide(props: ScreenGuideProps): JSX.Element;

// ---- SectionLabel
import * as React from 'react';
/**
 * The small uppercase kicker that heads a section, with an optional right-aligned count.
 */
export interface SectionLabelProps { children: React.ReactNode; aside?: React.ReactNode; as?: "h2" | "h3" | "h4"; style?: React.CSSProperties; }
export declare function SectionLabel(props: SectionLabelProps): JSX.Element;

// ---- Segmented
import * as React from 'react';
/**
 * 2–4 mutually exclusive view choices (e.g. Cards / Rows / Timeline).
 */
export interface SegmentedProps { options: (string | { value: string; label: string })[]; value: string; onChange?: (v: string) => void; label: string; }
export declare function Segmented(props: SegmentedProps): JSX.Element;

// ---- Select
import * as React from 'react';
/**
 * Native select drawn in Semester's palette.
 */
export interface SelectProps { label: string; hint?: string; options: (string | { value: string; label: string })[]; value?: string; onChange?: (e: any) => void; id?: string; }
export declare function Select(props: SelectProps): JSX.Element;

// ---- Sheet
import * as React from 'react';
/** Bottom sheet on mobile, window on desktop; the home of "Source & details". Also exports `SourceDetails`. */
export interface SheetProps { title: string; children?: React.ReactNode; onClose?: () => void; inline?: boolean; actions?: React.ReactNode; }
export declare function Sheet(props: SheetProps): JSX.Element;
export declare function SourceDetails(props: { items: { label: string; value: React.ReactNode }[] }): JSX.Element;

// ---- SideRail
import * as React from 'react';
/**
 * Desktop side rail on dark Ink chrome — persistent, quiet, labelled.
 * @startingPoint section="Navigation" subtitle="Desktop side rail on dark Ink chrome — persistent, quiet, labelled." viewport="700x400"
 */
export interface SideRailProps { groups: { label?: string; items: { id: string; label: string; icon: string; count?: number }[] }[]; current?: string; onNavigate?: (id: string) => void; foot?: React.ReactNode; brand?: boolean; }
export declare function SideRail(props: SideRailProps): JSX.Element;

// ---- SourceBadge
import * as React from 'react';
/**
 * Where a fact came from, beside the fact — controlled vocabulary (glyph + word + tone).
 * @startingPoint section="Trust & provenance" subtitle="Where a fact came from, beside the fact — controlled vocabulary (glyph + word + " viewport="700x400"
 */
export interface SourceBadgeProps { source: "official" | "connected" | "imported" | "personal" | "ai" | "estimated" | "review" | "stale" | "external" | "sample"; updated?: string; by?: string; onReport?: () => void; }
export declare function SourceBadge(props: SourceBadgeProps): JSX.Element;

// ---- SourceLine
import * as React from 'react';
/** The Source Line — Semester's signature device: a thin editorial rule from a statement to its source chip. */
export interface SourceLineProps { children: React.ReactNode; source?: string; by?: string; when?: string }
export declare function SourceLine(props: SourceLineProps): JSX.Element;

// ---- StatusChip
import * as React from 'react';
/**
 * One status chip — glyph + word + tone from the shared status table.
 */
export interface StatusChipProps { status: string; label?: string; }
export declare function StatusChip(props: StatusChipProps): JSX.Element;

// ---- StepStatus
import * as React from 'react';
/**
 * A process in named steps — shows the AI or system working instead of faking certainty.
 */
export interface StepStatusProps { steps: { label: string; state: "waiting" | "working" | "done" | "failed" }[]; label?: string; }
export declare function StepStatus(props: StepStatusProps): JSX.Element;

// ---- SuccessState
import * as React from 'react';
/**
 * Respectful acknowledgement that points at what is next — no confetti, streaks or ranks.
 */
export interface SuccessStateProps { title: string; body?: string; nextLabel?: string; onNext?: () => void; }
export declare function SuccessState(props: SuccessStateProps): JSX.Element;

// ---- SupportHandoff
import * as React from 'react';
export interface SupportHandoffProps { office: string; reason?: string; channel?: string; hours?: string; status?: "ready" | "sent" | "received" | "resolved"; reference?: string; onStart?: () => void; }
export declare function SupportHandoff(props: SupportHandoffProps): JSX.Element;

// ---- Switch
import * as React from 'react';
/**
 * On/off setting that speaks its state as a word beside the track.
 */
export interface SwitchProps { checked?: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean; }
export declare function Switch(props: SwitchProps): JSX.Element;

// ---- SystemContextBar
import * as React from 'react';
/**
 * Persistent top bar: location, term, ⌘K search, sync state, quiet tools.
 */
export interface SystemContextBarProps { location?: string; term?: string; sync?: string; onSearch?: () => void; actions?: React.ReactNode; }
export declare function SystemContextBar(props: SystemContextBarProps): JSX.Element;

// ---- TabBar
import * as React from 'react';
/**
 * Mobile bottom navigation for the five canonical destinations, always labelled.
 */
export interface TabBarProps { items: { id: string; label: string; icon: string }[]; current?: string; onNavigate?: (id: string) => void; }
export declare function TabBar(props: TabBarProps): JSX.Element;

// ---- TextField
import * as React from 'react';
/**
 * Labelled input/textarea with associated hint and error — the label is always visible.
 * @startingPoint section="Forms" subtitle="Labelled input/textarea with associated hint and error — the label is always vis" viewport="700x400"
 */
export interface TextFieldProps { label: string; hint?: string; error?: string; multiline?: boolean; id?: string; value?: string; placeholder?: string; onChange?: (e: any) => void; disabled?: boolean; }
export declare function TextField(props: TextFieldProps): JSX.Element;

// ---- UndoToast
import * as React from 'react';
/** One-sentence confirmation with Undo for reversible work — instead of an "are you sure?" dialog. */
export interface UndoToastProps { message: string; onUndo?: () => void; undoLabel?: string; }
export declare function UndoToast(props: UndoToastProps): JSX.Element;

// ---- VisibilityPicker
import * as React from 'react';
/** "Who can see this?" — the one privacy pattern, with the same four answers in every module. */
export interface VisibilityPickerProps { value?: "only-me" | "course" | "collaborators" | "portfolio"; onChange?: (v: string) => void; allowed?: string[]; locked?: boolean; origin?: "student-entered" | "institution-provided" | "connected-system"; onLearnMore?: () => void; }
export declare function VisibilityPicker(props: VisibilityPickerProps): JSX.Element;

// ---- Wordmark
import * as React from 'react';
/**
 * The Semester lockup — three-slab mark + SEMESTER in Barlow Condensed caps; also exports `Mark`.
 */
export interface WordmarkProps { size?: number; metal?: boolean; showWord?: boolean; style?: React.CSSProperties; }
export declare function Wordmark(props: WordmarkProps): JSX.Element;
export declare function Mark(props: { size?: number; style?: React.CSSProperties; className?: string }): JSX.Element;
