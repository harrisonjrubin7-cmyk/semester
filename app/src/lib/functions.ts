/**
 * Every function the sheet understands, written down where a person can read it.
 *
 * `lib/sheet.ts` knows 159 function names and until this file existed the app
 * offered nineteen of them on a ribbon and described the rest as "and the
 * scientific ones" in a sentence somebody had to press Help to find. Which
 * means the engine had `XLOOKUP`, `NETWORKDAYS` and `EFFECT` in it and nobody
 * could have known: a function you cannot spell is a function that does not
 * exist, because a misspelt name is `#NAME?` and the fastest way out of
 * `#NAME?` is to open Excel instead.
 *
 * So this is the catalogue Excel's Insert Function dialog and Sheets' function
 * list both are: the name, what you put in the brackets, one line on what it
 * answers, and an example that works. Grouped the way those two group them,
 * because that is the grouping a student has already learned.
 *
 * ## It is held to the engine
 *
 * `functions.test.ts` reads the `case` labels out of `lib/sheet.ts` and fails
 * if either side has something the other does not. A catalogue that drifts is
 * worse than none — it is a list of promises the calculator does not keep —
 * and the drift is guaranteed otherwise, because adding a function and
 * describing it are two different afternoons.
 *
 * ## What the wording is for
 *
 * Not "returns the arithmetic mean of its arguments". Every line here is
 * written as the question somebody has: *what mark do I need*, *how long until
 * the exam*, *how much of this payment is interest*. The point of a function
 * list is to be searched by somebody who does not know the name, and what they
 * type is the question.
 */

/** The eight shelves. Excel's own grouping, near enough to be familiar. */
export type FnGroup = 'maths' | 'stats' | 'logic' | 'lookup' | 'array' | 'text' | 'date' | 'money';

export interface FnGroupInfo {
  id: FnGroup;
  label: string;
  /** The line under the heading: what is on this shelf and when to come here. */
  blurb: string;
}

export const FN_GROUPS: FnGroupInfo[] = [
  { id: 'maths', label: 'Maths', blurb: 'Adding up, rounding, powers and the trigonometry.' },
  { id: 'stats', label: 'Statistics', blurb: 'Averages, spread, percentiles and the fitted line.' },
  { id: 'logic', label: 'Logic', blurb: 'Tests, branches, and asking what a cell holds.' },
  { id: 'lookup', label: 'Lookup', blurb: 'Finding a row in a table and reading across it.' },
  {
    id: 'array',
    label: 'Blocks',
    blurb: 'One formula that answers with a whole table. Type it in one cell and it fills the cells below and beside it — those stay empty, so deleting the formula takes the answer with it.',
  },
  { id: 'text', label: 'Text', blurb: 'Cutting up, joining and tidying what a column holds.' },
  { id: 'date', label: 'Dates', blurb: 'Days between, working days, and the parts of a date.' },
  { id: 'money', label: 'Money', blurb: 'Loans, savings, discounting and depreciation.' },
];

export interface FnDoc {
  name: string;
  /** What goes in the brackets. Square brackets mark what may be left out. */
  args: string;
  group: FnGroup;
  /** One line, as the question somebody arrived with. */
  says: string;
  /** A formula that works, short enough to read in a list. */
  example: string;
}

/**
 * The catalogue.
 *
 * In the order a shelf is read rather than alphabetically: the one everybody
 * wants first, then its neighbours. An alphabetical list is the right answer
 * for looking a name up and the wrong one for finding out what is there, and
 * the search box above it is what handles looking a name up.
 */
export const FUNCTIONS: FnDoc[] = [
  // ── Maths ───────────────────────────────────────────────────────────────
  { name: 'SUM', args: 'range', group: 'maths', says: 'Adds a column or a row up.', example: '=SUM(B2:B12)' },
  { name: 'PRODUCT', args: 'range', group: 'maths', says: 'Multiplies them all together.', example: '=PRODUCT(B2:B5)' },
  { name: 'SUMSQ', args: 'range', group: 'maths', says: 'Adds up the squares — the top of a variance by hand.', example: '=SUMSQ(B2:B12)' },
  { name: 'SUMPRODUCT', args: 'range, range', group: 'maths', says: 'Multiplies two columns row by row and adds the result — a weighted total.', example: '=SUMPRODUCT(B2:B6,C2:C6)' },
  { name: 'ROUND', args: 'number, places', group: 'maths', says: 'To a number of decimal places.', example: '=ROUND(B2,2)' },
  { name: 'ROUNDUP', args: 'number, places', group: 'maths', says: 'Always away from zero.', example: '=ROUNDUP(B2,0)' },
  { name: 'ROUNDDOWN', args: 'number, places', group: 'maths', says: 'Always towards zero.', example: '=ROUNDDOWN(B2,0)' },
  { name: 'MROUND', args: 'number, step', group: 'maths', says: 'To the nearest quarter hour, five marks, or anything else that is not a power of ten.', example: '=MROUND(B2,5)' },
  { name: 'CEILING', args: 'number, [step]', group: 'maths', says: 'Up to the next step.', example: '=CEILING(B2,0.5)' },
  { name: 'FLOOR', args: 'number, [step]', group: 'maths', says: 'Down to the last step.', example: '=FLOOR(B2,0.5)' },
  { name: 'INT', args: 'number', group: 'maths', says: 'Down to a whole number.', example: '=INT(B2)' },
  { name: 'TRUNC', args: 'number, [places]', group: 'maths', says: 'The decimals cut off rather than rounded.', example: '=TRUNC(B2,1)' },
  { name: 'ABS', args: 'number', group: 'maths', says: 'How far from zero, sign dropped.', example: '=ABS(B2-C2)' },
  { name: 'SIGN', args: 'number', group: 'maths', says: '1, 0 or −1 — which way it went.', example: '=SIGN(C2-B2)' },
  { name: 'MOD', args: 'number, divisor', group: 'maths', says: 'The remainder — every third row, every twelfth month.', example: '=MOD(A2,3)' },
  { name: 'QUOTIENT', args: 'number, divisor', group: 'maths', says: 'The division with the remainder thrown away.', example: '=QUOTIENT(B2,7)' },
  { name: 'POWER', args: 'number, exponent', group: 'maths', says: 'Raised to a power. `^` does the same.', example: '=POWER(1.05,10)' },
  { name: 'SQRT', args: 'number', group: 'maths', says: 'The square root.', example: '=SQRT(B2)' },
  { name: 'EXP', args: 'number', group: 'maths', says: 'e to the power of it — continuous growth.', example: '=EXP(0.05)' },
  { name: 'LN', args: 'number', group: 'maths', says: 'The natural logarithm, which is what a log-linear model wants.', example: '=LN(B2)' },
  { name: 'LOG', args: 'number, [base]', group: 'maths', says: 'The logarithm to any base — base 10 when none is named.', example: '=LOG(B2,2)' },
  { name: 'LOG10', args: 'number', group: 'maths', says: 'The logarithm to base 10.', example: '=LOG10(B2)' },
  { name: 'GCD', args: 'numbers', group: 'maths', says: 'The largest number that divides them all.', example: '=GCD(A2:A6)' },
  { name: 'LCM', args: 'numbers', group: 'maths', says: 'The smallest number they all divide into.', example: '=LCM(A2:A6)' },
  { name: 'FACT', args: 'number', group: 'maths', says: 'The factorial.', example: '=FACT(5)' },
  { name: 'COMBIN', args: 'n, k', group: 'maths', says: 'How many ways to choose k out of n, order ignored.', example: '=COMBIN(52,5)' },
  { name: 'PERMUT', args: 'n, k', group: 'maths', says: 'The same, with order counted.', example: '=PERMUT(10,3)' },
  { name: 'PI', args: '', group: 'maths', says: 'π.', example: '=PI()' },
  { name: 'SIN', args: 'radians', group: 'maths', says: 'Sine. Radians — `RADIANS` converts.', example: '=SIN(PI()/6)' },
  { name: 'COS', args: 'radians', group: 'maths', says: 'Cosine.', example: '=COS(0)' },
  { name: 'TAN', args: 'radians', group: 'maths', says: 'Tangent.', example: '=TAN(PI()/4)' },
  { name: 'ASIN', args: 'number', group: 'maths', says: 'The angle whose sine this is.', example: '=ASIN(0.5)' },
  { name: 'ACOS', args: 'number', group: 'maths', says: 'The angle whose cosine this is.', example: '=ACOS(0.5)' },
  { name: 'ATAN', args: 'number', group: 'maths', says: 'The angle whose tangent this is.', example: '=ATAN(1)' },
  { name: 'ATAN2', args: 'x, y', group: 'maths', says: 'The angle to a point, all four quadrants.', example: '=ATAN2(1,1)' },
  { name: 'SINH', args: 'number', group: 'maths', says: 'Hyperbolic sine.', example: '=SINH(1)' },
  { name: 'COSH', args: 'number', group: 'maths', says: 'Hyperbolic cosine.', example: '=COSH(1)' },
  { name: 'TANH', args: 'number', group: 'maths', says: 'Hyperbolic tangent.', example: '=TANH(1)' },
  { name: 'DEGREES', args: 'radians', group: 'maths', says: 'Radians as degrees.', example: '=DEGREES(PI())' },
  { name: 'RADIANS', args: 'degrees', group: 'maths', says: 'Degrees as radians — what the trigonometry above wants.', example: '=RADIANS(30)' },

  // ── Statistics ──────────────────────────────────────────────────────────
  { name: 'AVERAGE', args: 'range', group: 'stats', says: 'The mean. Blanks are skipped, not counted as zero.', example: '=AVERAGE(B2:B12)' },
  { name: 'AVG', args: 'range', group: 'stats', says: 'The same as AVERAGE, for a formula typed from memory.', example: '=AVG(B2:B12)' },
  { name: 'MEDIAN', args: 'range', group: 'stats', says: 'The middle one — the average to quote when one mark is an outlier.', example: '=MEDIAN(B2:B12)' },
  { name: 'MODE', args: 'range', group: 'stats', says: 'The commonest value.', example: '=MODE(B2:B12)' },
  { name: 'GEOMEAN', args: 'range', group: 'stats', says: 'The average of things that compound — growth rates, returns.', example: '=GEOMEAN(B2:B6)' },
  { name: 'HARMEAN', args: 'range', group: 'stats', says: 'The average of rates over a fixed distance.', example: '=HARMEAN(B2:B6)' },
  { name: 'TRIMMEAN', args: 'range, share', group: 'stats', says: 'The mean with that share of the extremes dropped, half off each end.', example: '=TRIMMEAN(B2:B12,0.2)' },
  { name: 'COUNT', args: 'range', group: 'stats', says: 'How many numbers are in it.', example: '=COUNT(B2:B12)' },
  { name: 'COUNTA', args: 'range', group: 'stats', says: 'How many cells have anything in them.', example: '=COUNTA(B2:B12)' },
  { name: 'COUNTBLANK', args: 'range', group: 'stats', says: 'How many are still empty — what is left to mark.', example: '=COUNTBLANK(B2:B12)' },
  { name: 'COUNTUNIQUE', args: 'range', group: 'stats', says: 'How many different things are in it.', example: '=COUNTUNIQUE(A2:A40)' },
  { name: 'MIN', args: 'range', group: 'stats', says: 'The smallest.', example: '=MIN(B2:B12)' },
  { name: 'MAX', args: 'range', group: 'stats', says: 'The largest.', example: '=MAX(B2:B12)' },
  { name: 'LARGE', args: 'range, k', group: 'stats', says: 'The kth largest — the second-best score, the third-worst.', example: '=LARGE(B2:B12,2)' },
  { name: 'SMALL', args: 'range, k', group: 'stats', says: 'The kth smallest.', example: '=SMALL(B2:B12,2)' },
  { name: 'RANK', args: 'value, range, [ascending]', group: 'stats', says: 'Where one mark sits in the class. Ties share the better rank.', example: '=RANK(B2,B$2:B$40)' },
  { name: 'PERCENTRANK', args: 'range, value', group: 'stats', says: 'The same as a share — what fraction of the class it beats.', example: '=PERCENTRANK(B$2:B$40,B2)' },
  { name: 'PERCENTILE', args: 'range, share', group: 'stats', says: 'The mark at a given share of the way up.', example: '=PERCENTILE(B2:B40,0.9)' },
  { name: 'QUARTILE', args: 'range, quarter', group: 'stats', says: 'The same at a quarter, a half or three quarters — 0 to 4.', example: '=QUARTILE(B2:B40,1)' },
  { name: 'STDEV', args: 'range', group: 'stats', says: 'The standard deviation of a sample — divides by n − 1.', example: '=STDEV(B2:B12)' },
  { name: 'STDEVP', args: 'range', group: 'stats', says: 'The same for a whole population — divides by n.', example: '=STDEVP(B2:B12)' },
  { name: 'VAR', args: 'range', group: 'stats', says: 'The sample variance.', example: '=VAR(B2:B12)' },
  { name: 'VARP', args: 'range', group: 'stats', says: 'The population variance.', example: '=VARP(B2:B12)' },
  { name: 'AVEDEV', args: 'range', group: 'stats', says: 'The average distance from the mean, unsquared.', example: '=AVEDEV(B2:B12)' },
  { name: 'DEVSQ', args: 'range', group: 'stats', says: 'The sum of squared distances from the mean.', example: '=DEVSQ(B2:B12)' },
  { name: 'CORREL', args: 'range, range', group: 'stats', says: 'How tightly two columns move together, −1 to 1.', example: '=CORREL(B2:B40,C2:C40)' },
  { name: 'SLOPE', args: 'ys, xs', group: 'stats', says: 'The slope of the fitted line — the coefficient a regression reports.', example: '=SLOPE(C2:C40,B2:B40)' },
  { name: 'INTERCEPT', args: 'ys, xs', group: 'stats', says: 'Where that line crosses the axis.', example: '=INTERCEPT(C2:C40,B2:B40)' },
  { name: 'RSQ', args: 'ys, xs', group: 'stats', says: 'How much of the variation the line explains.', example: '=RSQ(C2:C40,B2:B40)' },
  { name: 'FORECAST', args: 'x, ys, xs', group: 'stats', says: 'What the fitted line predicts at a value.', example: '=FORECAST(20,C2:C40,B2:B40)' },
  { name: 'COUNTIF', args: 'range, is', group: 'stats', says: 'How many match — "A", ">=90", "*late*".', example: '=COUNTIF(C2:C40,">=90")' },
  { name: 'COUNTIFS', args: 'range, is, …', group: 'stats', says: 'How many match all of several tests at once.', example: '=COUNTIFS(A2:A40,"ECON",C2:C40,">=90")' },
  { name: 'SUMIF', args: 'range, is, [add up]', group: 'stats', says: 'Adds up the rows that match.', example: '=SUMIF(A2:A40,"ECON",C2:C40)' },
  { name: 'SUMIFS', args: 'add up, range, is, …', group: 'stats', says: 'The same under several tests. The column being added comes first.', example: '=SUMIFS(C2:C40,A2:A40,"ECON",B2:B40,"Essay")' },
  { name: 'AVERAGEIF', args: 'range, is, [average]', group: 'stats', says: 'The mean of the rows that match.', example: '=AVERAGEIF(A2:A40,"ECON",C2:C40)' },
  { name: 'AVERAGEIFS', args: 'average, range, is, …', group: 'stats', says: 'The same under several tests.', example: '=AVERAGEIFS(C2:C40,A2:A40,"ECON",B2:B40,"Essay")' },
  { name: 'MAXIFS', args: 'range, test range, is, …', group: 'stats', says: 'The best mark among the rows that match.', example: '=MAXIFS(C2:C40,A2:A40,"ECON")' },
  { name: 'MINIFS', args: 'range, test range, is, …', group: 'stats', says: 'The worst one.', example: '=MINIFS(C2:C40,A2:A40,"ECON")' },

  // ── Logic ───────────────────────────────────────────────────────────────
  { name: 'IF', args: 'test, then, [else]', group: 'logic', says: 'One test, two answers.', example: '=IF(B2>=50,"Pass","Fail")' },
  { name: 'IFS', args: 'test, then, …', group: 'logic', says: 'A chain of tests, stopping at the first that holds — a grade scale.', example: '=IFS(B2>=90,"A",B2>=80,"B",TRUE,"C")' },
  { name: 'SWITCH', args: 'value, is, then, …, [otherwise]', group: 'logic', says: 'The same when every test is "is it this one".', example: '=SWITCH(A2,"Mon","Rand 308","Wed","Buttrick 101","—")' },
  { name: 'CHOOSE', args: 'n, …', group: 'logic', says: 'The nth of the rest.', example: '=CHOOSE(2,"first","second","third")' },
  { name: 'AND', args: 'tests', group: 'logic', says: 'True when all of them are.', example: '=AND(B2>=50,C2>=50)' },
  { name: 'OR', args: 'tests', group: 'logic', says: 'True when any of them is.', example: '=OR(B2>=90,C2>=90)' },
  { name: 'XOR', args: 'tests', group: 'logic', says: 'True when an odd number of them are — one or the other, not both.', example: '=XOR(B2>90,C2>90)' },
  { name: 'NOT', args: 'test', group: 'logic', says: 'The other way round.', example: '=NOT(B2="")' },
  { name: 'IFERROR', args: 'value, instead', group: 'logic', says: 'Catches any error and puts something else there.', example: '=IFERROR(B2/C2,"")' },
  { name: 'IFNA', args: 'value, instead', group: 'logic', says: 'Catches only a missing lookup, leaving real faults visible.', example: '=IFNA(VLOOKUP(A2,$F$2:$G$9,2),"not listed")' },
  { name: 'NA', args: '', group: 'logic', says: 'Writes "no answer here" on purpose, so a blank is never mistaken for one.', example: '=IF(B2="",NA(),B2)' },
  { name: 'ISBLANK', args: 'value', group: 'logic', says: 'Whether the cell is empty.', example: '=ISBLANK(B2)' },
  { name: 'ISNUMBER', args: 'value', group: 'logic', says: 'Whether it is a number.', example: '=ISNUMBER(B2)' },
  { name: 'ISTEXT', args: 'value', group: 'logic', says: 'Whether it is text.', example: '=ISTEXT(B2)' },
  { name: 'ISLOGICAL', args: 'value', group: 'logic', says: 'Whether it is TRUE or FALSE.', example: '=ISLOGICAL(B2)' },
  { name: 'ISERROR', args: 'value', group: 'logic', says: 'Whether it went wrong at all.', example: '=ISERROR(B2/C2)' },
  { name: 'ISERR', args: 'value', group: 'logic', says: 'The same, but a missing lookup does not count.', example: '=ISERR(B2/C2)' },
  { name: 'ISNA', args: 'value', group: 'logic', says: 'Whether a lookup found nothing.', example: '=ISNA(MATCH(A2,$F$2:$F$9))' },
  { name: 'ISEVEN', args: 'number', group: 'logic', says: 'Whether it is even — shading alternate rows.', example: '=ISEVEN(A2)' },
  { name: 'ISODD', args: 'number', group: 'logic', says: 'Whether it is odd.', example: '=ISODD(A2)' },
  { name: 'N', args: 'value', group: 'logic', says: 'The value as a number, and 0 for anything that is not one.', example: '=N(B2)' },
  { name: 'T', args: 'value', group: 'logic', says: 'The value if it is text, and nothing if it is not.', example: '=T(B2)' },

  // ── Lookup ──────────────────────────────────────────────────────────────
  { name: 'XLOOKUP', args: 'what, where, answers, [if missing]', group: 'lookup', says: 'Finds a row and reads a named column — the one to learn.', example: '=XLOOKUP(A2,$F$2:$F$9,$G$2:$G$9,"—")' },
  { name: 'VLOOKUP', args: 'what, table, column, [loose]', group: 'lookup', says: 'Finds a row down the first column and counts across. Exact unless told otherwise.', example: '=VLOOKUP(A2,$F$2:$G$9,2)' },
  { name: 'HLOOKUP', args: 'what, table, row, [loose]', group: 'lookup', says: 'The same lying on its side.', example: '=HLOOKUP(A2,$F$1:$M$2,2)' },
  { name: 'MATCH', args: 'what, range', group: 'lookup', says: 'Which position something is at.', example: '=MATCH("Essay",$F$2:$F$9)' },
  { name: 'INDEX', args: 'range, row, [column]', group: 'lookup', says: 'The cell at a position. With MATCH it is XLOOKUP the long way.', example: '=INDEX($G$2:$G$9,MATCH(A2,$F$2:$F$9))' },
  { name: 'ROWS', args: 'range', group: 'lookup', says: 'How many rows a range covers.', example: '=ROWS(A2:A40)' },
  { name: 'COLUMNS', args: 'range', group: 'lookup', says: 'How many columns it covers.', example: '=COLUMNS(A2:D2)' },

  // ── Blocks ──────────────────────────────────────────────────────────────
  { name: 'FILTER', args: 'range, test, [if none]', group: 'array', says: 'The rows where the test held — everyone over 60, every unpaid row.', example: '=FILTER(A2:C40,C2:C40>60)' },
  { name: 'SORT', args: 'range, [column], [-1 for down]', group: 'array', says: 'The same rows in order, without touching the ones you typed.', example: '=SORT(A2:C40,3,-1)' },
  { name: 'UNIQUE', args: 'range, [TRUE for across]', group: 'array', says: 'Each distinct row once — the list of modules, of names, of categories.', example: '=UNIQUE(B2:B40)' },
  { name: 'SEQUENCE', args: 'rows, [columns], [start], [step]', group: 'array', says: 'A block of counting numbers, so a week or a month column is one formula.', example: '=SEQUENCE(12)' },
  { name: 'TEXTSPLIT', args: 'text, [delimiter]', group: 'array', says: 'One cell cut into several across — a pasted comma list into columns.', example: '=TEXTSPLIT(A2,",")' },

  // ── Text ────────────────────────────────────────────────────────────────
  { name: 'CONCAT', args: 'pieces', group: 'text', says: 'Joins them end to end. `&` does the same.', example: '=CONCAT(A2," ",B2)' },
  { name: 'TEXTJOIN', args: 'separator, skip blanks, pieces', group: 'text', says: 'Joins a column into a sentence with a separator between.', example: '=TEXTJOIN(", ",TRUE,A2:A9)' },
  { name: 'LEN', args: 'text', group: 'text', says: 'How many characters.', example: '=LEN(A2)' },
  { name: 'LEFT', args: 'text, [n]', group: 'text', says: 'The first n characters.', example: '=LEFT(A2,4)' },
  { name: 'RIGHT', args: 'text, [n]', group: 'text', says: 'The last n.', example: '=RIGHT(A2,4)' },
  { name: 'MID', args: 'text, start, n', group: 'text', says: 'n characters from a position.', example: '=MID(A2,5,3)' },
  { name: 'SPLIT', args: 'text, separator, [which]', group: 'text', says: 'The nth piece between separators — a course code out of "ECON 1010".', example: '=SPLIT(A2," ",1)' },
  { name: 'FIND', args: 'needle, text, [from]', group: 'text', says: 'Where a piece of text starts, counting capitals as different.', example: '=FIND("-",A2)' },
  { name: 'SEARCH', args: 'needle, text, [from]', group: 'text', says: 'The same, ignoring capitals.', example: '=SEARCH("essay",A2)' },
  { name: 'SUBSTITUTE', args: 'text, old, new, [which]', group: 'text', says: 'Swaps one piece of text for another wherever it appears.', example: '=SUBSTITUTE(A2,"  "," ")' },
  { name: 'REPLACE', args: 'text, start, n, new', group: 'text', says: 'Swaps by position rather than by what is there.', example: '=REPLACE(A2,1,4,"2026")' },
  { name: 'TRIM', args: 'text', group: 'text', says: 'Spaces off both ends — what a paste always brings with it.', example: '=TRIM(A2)' },
  { name: 'UPPER', args: 'text', group: 'text', says: 'In capitals.', example: '=UPPER(A2)' },
  { name: 'LOWER', args: 'text', group: 'text', says: 'In lower case.', example: '=LOWER(A2)' },
  { name: 'PROPER', args: 'text', group: 'text', says: 'First letters capitalised — a name list out of an export.', example: '=PROPER(A2)' },
  { name: 'EXACT', args: 'text, text', group: 'text', says: 'Whether two pieces of text match exactly, capitals included.', example: '=EXACT(A2,B2)' },
  { name: 'REPT', args: 'text, n', group: 'text', says: 'Repeated n times — a bar chart in a column.', example: '=REPT("▮",ROUND(B2/10,0))' },
  { name: 'VALUE', args: 'text', group: 'text', says: 'A number that arrived as text, as a number again.', example: '=VALUE(A2)' },
  { name: 'TEXT', args: 'value, format', group: 'text', says: 'A number or a date under a picture of itself.', example: '=TEXT(TODAY(),"d mmm yyyy")' },
  { name: 'CHAR', args: 'number', group: 'text', says: 'The character at a code point — 10 is a line break.', example: '=CHAR(10)' },
  { name: 'CODE', args: 'text', group: 'text', says: 'The code point of the first character.', example: '=CODE(A2)' },

  // ── Dates ───────────────────────────────────────────────────────────────
  { name: 'TODAY', args: '', group: 'date', says: 'Today, as a day count.', example: '=TODAY()' },
  { name: 'NOW', args: '', group: 'date', says: 'Now, with the time of day in the fraction.', example: '=NOW()' },
  { name: 'DATE', args: 'year, month, day', group: 'date', says: 'A date built from its three parts.', example: '=DATE(2026,12,11)' },
  { name: 'TIME', args: 'hours, minutes, [seconds]', group: 'date', says: 'A time of day, as the fraction of a day a sheet stores it as.', example: '=TIME(9,35,0)' },
  { name: 'YEAR', args: 'date', group: 'date', says: 'The year out of a date.', example: '=YEAR(A2)' },
  { name: 'MONTH', args: 'date', group: 'date', says: 'The month, 1 to 12.', example: '=MONTH(A2)' },
  { name: 'DAY', args: 'date', group: 'date', says: 'The day of the month.', example: '=DAY(A2)' },
  { name: 'HOUR', args: 'time', group: 'date', says: 'The hour out of a time.', example: '=HOUR(A2)' },
  { name: 'MINUTE', args: 'time', group: 'date', says: 'The minutes.', example: '=MINUTE(A2)' },
  { name: 'SECOND', args: 'time', group: 'date', says: 'The seconds.', example: '=SECOND(A2)' },
  { name: 'WEEKDAY', args: 'date', group: 'date', says: 'Which day of the week — 1 is Sunday.', example: '=WEEKDAY(A2)' },
  { name: 'ISOWEEKNUM', args: 'date', group: 'date', says: 'Which week of the year, the way a timetable counts them.', example: '=ISOWEEKNUM(A2)' },
  { name: 'DAYS', args: 'end, start', group: 'date', says: 'How many days between two dates.', example: '=DAYS(B2,TODAY())' },
  { name: 'DATEDIF', args: 'from, to, unit', group: 'date', says: 'Whole years, months or days between — "Y", "M" or "D".', example: '=DATEDIF(TODAY(),B2,"D")' },
  { name: 'NETWORKDAYS', args: 'from, to, [days off]', group: 'date', says: 'Working days between, weekends and a list of holidays skipped.', example: '=NETWORKDAYS(TODAY(),B2,$F$2:$F$9)' },
  { name: 'WORKDAY', args: 'from, n, [days off]', group: 'date', says: 'The date n working days along.', example: '=WORKDAY(TODAY(),10)' },
  { name: 'EDATE', args: 'date, months', group: 'date', says: 'The same day of the month, n months on — and the last day of a short one.', example: '=EDATE(A2,3)' },
  { name: 'EOMONTH', args: 'date, months', group: 'date', says: 'The last day of the month n months on — a quarter end.', example: '=EOMONTH(TODAY(),0)' },
  { name: 'YEARFRAC', args: 'from, to, [basis]', group: 'date', says: 'The fraction of a year between, on the day count a finance question names.', example: '=YEARFRAC(A2,B2,0)' },

  // ── Money ───────────────────────────────────────────────────────────────
  { name: 'PMT', args: 'rate, periods, amount, [end value], [type]', group: 'money', says: 'The instalment on a loan. The rate is per period, not per year.', example: '=PMT(0.05/12,60,-20000)' },
  { name: 'NPER', args: 'rate, payment, amount, [end value], [type]', group: 'money', says: 'How many payments it takes to clear it.', example: '=NPER(0.05/12,-400,20000)' },
  { name: 'IPMT', args: 'rate, period, periods, amount, [end], [type]', group: 'money', says: 'How much of one instalment is interest.', example: '=IPMT(0.05/12,1,60,-20000)' },
  { name: 'PPMT', args: 'rate, period, periods, amount, [end], [type]', group: 'money', says: 'How much of it is principal.', example: '=PPMT(0.05/12,1,60,-20000)' },
  { name: 'PV', args: 'rate, periods, payment, [end value], [type]', group: 'money', says: 'What a stream of payments is worth today.', example: '=PV(0.05,10,-1000)' },
  { name: 'FV', args: 'rate, periods, payment, [amount], [type]', group: 'money', says: 'What saving that much will come to.', example: '=FV(0.04/12,120,-200)' },
  { name: 'RATE', args: 'periods, payment, amount, [end value], [type]', group: 'money', says: 'The rate implied by a loan somebody quoted you.', example: '=RATE(60,-400,20000)' },
  { name: 'NPV', args: 'rate, flows', group: 'money', says: 'Discounted value of the flows. The one made today goes outside it.', example: '=A2+NPV(0.1,B2:F2)' },
  { name: 'IRR', args: 'flows', group: 'money', says: 'The rate at which those flows come to nothing.', example: '=IRR(A2:F2)' },
  { name: 'EFFECT', args: 'nominal rate, periods a year', group: 'money', says: 'What an advertised APR actually costs over a year.', example: '=EFFECT(0.24,12)' },
  { name: 'NOMINAL', args: 'effective rate, periods a year', group: 'money', says: 'The other way round — the rate that would be advertised.', example: '=NOMINAL(0.268,12)' },
  { name: 'SLN', args: 'cost, salvage, life', group: 'money', says: 'Straight-line depreciation, one period of it.', example: '=SLN(9000,1000,5)' },
];

/** One function by name, however it was typed. */
export function fnDoc(name: string): FnDoc | undefined {
  const wanted = name.trim().toUpperCase();
  return FUNCTIONS.find((f) => f.name === wanted);
}

/** Everything on one shelf, in the order it is written above. */
export function inGroup(group: FnGroup): FnDoc[] {
  return FUNCTIONS.filter((f) => f.group === group);
}

/**
 * The catalogue searched by somebody who does not know the name.
 *
 * Matches on the name first, then on the line under it, and the order is that
 * order: typing `sum` should put `SUM` at the top rather than the four
 * functions whose description happens to contain "sums". A name that starts
 * with what was typed beats one that merely contains it, for the same reason.
 *
 * Empty gives everything, which is what makes the same box a browse and a
 * search rather than two controls.
 */
export function findFunctions(query: string): FnDoc[] {
  const q = query.trim().toLowerCase();
  if (!q) return FUNCTIONS;
  const rank = (f: FnDoc): number => {
    const name = f.name.toLowerCase();
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    if (f.says.toLowerCase().includes(q)) return 3;
    if (f.args.toLowerCase().includes(q)) return 4;
    return 5;
  };
  return FUNCTIONS.map((f) => ({ f, at: rank(f) }))
    .filter((r) => r.at < 5)
    .sort((a, b) => a.at - b.at)
    .map((r) => r.f);
}

/**
 * What goes in the cell when a function is picked out of the list.
 *
 * The name and its brackets, and nothing inside them. Not a wizard and not a
 * guess at the arguments: what somebody needs from a function list is the
 * spelling, because a misspelt name is `#NAME?` and a wrongly guessed range is
 * a number that looks right. A function that takes nothing keeps its empty
 * brackets, because `=PI` is not a formula.
 */
export function skeleton(fn: FnDoc): string {
  return `=${fn.name}()`;
}
