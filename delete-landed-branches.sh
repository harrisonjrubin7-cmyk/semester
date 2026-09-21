#!/usr/bin/env bash
#
# Delete the claude/* branches whose work has landed in main.
#
# 182 claude/* branches: 171 here, 5 excluded for having an open pull request,
# and 6 that no pull request of their own ever landed — those carry their own
# note at the bottom, as does one stray ref outside the claude/* namespace that
# is deleted alongside them.
#
# Regenerated 2026-09-21 13:50 UTC, classified against main @ 8e135742. The counts move
# fast, so treat the SHAs as the authority and the numbers in this comment as
# the day they were written. How fast: between building this list and
# committing it, main took 33 commits and moved to 1bae34de, four pull requests
# opened, one branch that read as open at the start read as merged by the end,
# and a branch that did not exist when the list was built does now. Every one
# of those is accounted for below rather than averaged away.
#
# The SHAs are pinned to the moment each branch was classified, which is the
# only moment they mean anything: re-pinning a branch to a commit nobody has
# looked at would hand the guard below a fact it cannot check, which is the one
# thing it exists to stop.
#
# ── What this regeneration changed, and why ───────────────────────────────
#
# The previous list classified each branch by whether it HAD a merged pull
# request. That is the wrong question for a branch that gets reused, and this
# repository reuses them heavily — one branch here is the head of nine separate
# pull requests. The right question is about the commit the branch points at
# NOW:
#
#     is this exact tip the head of a merged pull request, or an ancestor
#     of main?
#
# Either answer means deleting the branch loses nothing. Neither answer means
# the tip carries work that was never merged in any form.
#
# Asked that way, two branches moved out of the delete list:
#
#     claude/app-ux-calendar-refactor-hb7cwr   tip is the head of #92, closed unmerged
#     claude/draggable-elements-app-8cm3zv     tip is the head of #93, closed unmerged
#
# Both had merged pull requests earlier in their lives, which is why the old
# pass cleared them, and both were listed at exactly these SHAs — so the
# run-time guard would not have saved them either. It only skips branches that
# MOVED, and these had not moved. Each carries one commit main does not have: a
# fix for a red main on 9 September, closed unmerged because somebody else
# fixed it first. Stale, but not landed, so they are deleted deliberately from
# ORPHANED with their SHA recorded, rather than silently as merged work.
#
# ── Why "merged" does not imply "ancestor of main" here ───────────────────
#
# This repository has used both merge strategies. Recent pull requests land as
# merge commits ("Merge pull request #558: ..."), which makes the branch head a
# literal ancestor of main. Older ones were squash-merged, which does not: #110
# squashed claude/app-design-review-dgqbe2's seven commits into the single
# commit f32e4f24 on main, so that branch's tip is fully landed and is not an
# ancestor of anything.
#
# So ancestry alone clears only 74 of these 171. The other 97 are squash
# merges, cleared by GitHub saying their exact tip SHA is a merged pull
# request's head. Neither signal is sufficient alone; a branch is listed here
# if EITHER holds.
#
# ── The checks this list was built from ───────────────────────────────────
#
# Four, because the first three each have a blind spot:
#
#   1. GitHub, paged through every pull request: tip SHA == a merged head.
#      Authoritative, and the only signal that works for squash merges.
#   2. git merge-base --is-ancestor <tip> main. Independent of GitHub, and the
#      only signal that works for a branch with no pull request at all.
#   3. Main's own history searched for each tip's commit subject. This one is
#      informative when it hits and SILENT when it misses — a squash commit's
#      title is the pull request's title, not the branch commit's subject, so a
#      merge-commit tip legitimately does not appear. It confirmed 57 of 97 and
#      says nothing about the other 40. Reported as 57 confirmations, not 40
#      failures.
#   4. For the seven cleared only by (1) whose subject check was silent, main
#      was searched for the squash of the pull request number claimed. All
#      seven found; a fabricated pull request number found nothing.
#
# Controls, because a check that clears everything is also what a broken check
# looks like. A fabricated commit read as not-an-ancestor; a fabricated subject
# was not found in main; the closed-unmerged pull requests #74, #92, #93, #109
# and #147 have no squash and no merge commit in main. The first version of
# check 3 matched whole lines and reported all 97 branches unlanded — GitHub
# prefixes each subject with "* " in a squash body. A probe that convicts
# every suspect was thrown away rather than believed.
#
# ── Two readings from earlier passes that were wrong ──────────────────────
#
# Both came from the same cause, and it is worth naming because it is invisible
# and it recurs: a session working in a SHALLOW clone.
#
# An agent checkout here is created with truncated history. Ancestry questions
# asked in one are not merely incomplete, they are confidently wrong: commits
# past the graft boundary read as unrelated. That produced "the four that could
# not be cleared share no ancestor with main at all", which is false. Fetched
# whole, all six orphans share an ancestor with main, the oldest from 8
# September. It also produced, in this session before the clone was repaired,
# a reading of 21 contained branches and 81,441 leftover commits, which was
# discarded rather than reported.
#
# If you are regenerating this file, check for .git/shallow FIRST and run
# git fetch --unshallow if it is there. Nothing downstream is trustworthy
# until you have.
#
# ── The five excluded for an open pull request ────────────────────────────
#
#     claude/bold-babbage-n7sjoj        #560
#     claude/sleepy-brown-nrd2o5        #561
#     claude/vigilant-ramanujan-xjzj73  #562
#     claude/keen-franklin-65y2db       #563
#     claude/vigilant-brown-b8wdcy      the branch this regeneration is pushed on
#
# The open set is the one place a stale reading costs something — it is what
# keeps a live branch off the list — so it was read last rather than taken from
# the same pass as the rest. Reading it last is what caught all four: the first
# three were in the delete list, pinned to SHAs they had since moved off, and
# the fourth did not exist. Had it been read first, three live branches would
# have been listed and only the run-time guard standing between them and a
# delete.
#
# The same re-read moved one branch the other way. claude/gallant-fermat-sq5iqk
# was excluded for an open #559 when the list was built; #559 merged at 13:44,
# its head is exactly that branch's current tip, and it is now listed. That is
# a classification, not a refresh — the tip was looked at and cleared, which is
# the bar every other SHA in this file had to meet.
#
# Note that "merged" comes back false on every pull request in a list
# response; only "merged_at" is populated. A classification built on the
# boolean would have read all of them as unmerged and this file would be empty.
#
# ── The run-time guard ────────────────────────────────────────────────────
#
# Every branch is pinned to the commit it pointed at when this list was made,
# and is deleted only if it still points there. A branch that has taken a
# commit since is a branch whose new commit nobody has classified, so it is
# skipped and named. That guard is what makes a stale list safe. It is not a
# substitute for classifying the tip correctly in the first place, which is the
# lesson of the two branches moved to ORPHANED above.
#
# ── Undoing this ─────────────────────────────────────────────────────────
#
# The SHA beside each branch is also the way back. To restore one:
#
#     git push origin <sha>:refs/heads/<branch>
#
# That works as long as the object survives on the remote, which for GitHub is
# a matter of weeks, not forever. Keep this file if you want the option.
#
set -uo pipefail

# branch<TAB>sha
BRANCHES="
claude/a-busy-day-ate-the-week	b7d6bae6c07b6a8e4b0f85f6979668599727e614
claude/a-date-this-app-cannot-store	0ee6ca10e6a302440ef7e3e5a72cd6d9a86db0bb
claude/add-course-icon-button-a1o2mk	569a1a7761e105d7fa7574408d3b497c49c5df23
claude/admiring-pascal-ymq1s0	1d6a42b4283d8fee0470f420430d165082c3bcc4
claude/admiring-ptolemy-2modu7	3aacddecc554f60a597ff9d5b5e315bfa93d1469
claude/adoring-johnson-9u6cuw	3131b4c4a7926cc1f0e41cdeb8b09be8aa5f1263
claude/affectionate-brown-tgqjrb	cb7c63e3d79cebb15896a926859733c2e8471eb8
claude/also-functionality-1606uu	6e5f10797d3828b03aad6b23d73664159128b9d9
claude/api-key-integration-2vzsxh	8b09710c49050b2160d74f6930cdfba86597a01b
claude/app-ai-integration-gbhm8z	8fd2704c833da28e0133d48309af51cd9a5f3aa4
claude/app-audit-cleanup-po2tdp	4d8c3b15f1f153120a5d772ac06024c419e86358
claude/app-capabilities-expansion-3t1zbt	a691f1c6f76cd02ada54c2427cc8f90da9f86cb1
claude/app-design-code-review-8zh4px	d3830e7339532a6933cb685cf00aa19ceb406375
claude/app-design-review-dgqbe2	004aad35509b8712800a4a74cc9f3edd5a195d74
claude/app-functionality-review-twdu6o	ef7a7d2d09ab41640690e01db6982970a5ed5eb5
claude/app-functionality-ux-review-j14m1t	012013315b39c272c2b6dd3d9b92960654dca98f
claude/app-launcher-icon-menu-l4ex6q	e51a83aa901a843021fe199dd272af51d79e070e
claude/app-refactor-streamline-7xk5wk	9be22e19322c4167f8632d664d463209b8f2d284
claude/app-usability-review-e6y92d	542df586316365739fe2f9af72fcdccecfac1ab6
claude/app-wide-improvements-cs8l9l	8b21a7c07a00a5f2eaf0ef14367ab867d27d58be
claude/ask-claude-mobile-layout-ss2cfd	ede5e24eb3bad7b2b83e6c34116d9a633f30365b
claude/assistant-blind-to-feeds	f754074a275f971404db9f8a4786ae61e5359fce
claude/assistant-cut-stream	5553105bf8e4b4a2866e1b4c1a848949bc6bc666
claude/awesome-rubin-63w34j	001c1251b3fcb19a1bc1bc6fed1a74ffef0d891d
claude/backup-feeds	51733a6b6989562ac42e69539214e21cc6082ad6
claude/beautiful-noether-3q3r5e	1859e40c1f56aa49026040ade6744d5719d77237
claude/bibtex-escapes	43fad71814cab924266b504059d86f6c699c11a1
claude/bold-carson-rwo974	e2618c6cf721b0eca06c1a6bf17b3831de53a719
claude/bold-fermat-089zmf	4911decf71919464a595c57de0e53d67e5061bb8
claude/brave-hamilton-luax4r	1cb26478ca06cdc9f149286e5b55c10593425de6
claude/by-task-design-layout-4hnei5	5909a62922e195384012307e9962ddbb780f963f
claude/by-task-page-redesign-a6xu4r	c4c995f86916a1af7bad420f8bdf5abb58b883e4
claude/calendar-settings-tabs-mjg9ow	30d8bcd47dac41a91fbb2362c9ab105532887317
claude/calendar-url-ics-upload-wri6fo	586f3588fb45f2a180e1d834e865cbd8a018b21a
claude/canceled-class-nudge	67e977a334f2bf0ec18fee1c1c50df3f951ee029
claude/capture-lead-in	08d3adcd42e99cd84e975b38fc5b85d78309e496
claude/capture-sept	19e231577fcb876051d5bd8129fb25b5da0d5118
claude/chapters-named	8c60ed5375cf41d8007a68913e58644224a3686f
claude/class-length-ahead	6d8d0cc48ff9ad01a0143b3e0d678e6bb35b93fa
claude/cleanup-script-keeps-going	dd9c9f1704189f81f15243dc4d25247dc055c2f9
claude/confident-lamport-po11nu	4969f378c59555a4f09218c89f7f8559527a7685
claude/cool-edison-pjf6gb	740c461ea8638f7b3fa30c1719c07d54994158fb
claude/course-color-coding-erznos	5b6ae85d7547dabe20420cab72adc0795150caf8
claude/credentials-form	b3cf0bfcae3253bd0f773d4b174594678e9ed8cf
claude/dazzling-pasteur-rsjad3	2f05fa856f097c7f5ede565e4f11dae1c1347504
claude/dazzling-thompson-1tz5is	e4c460fa5e4a8e654a5e02c98a17c39513009dec
claude/db-open-timeout	a78224c1a147c8b8def5506df3646c565d9b0e5c
claude/delete-landed-branches	6c43213ba19a105c202067a596e458da555fa2e9
claude/delete-orphan-history	3ba1990abe4220e395916f3976e6319949e64359
claude/determined-hopper-15h6vp	7b173f687f24cffe574a2ce0b6ea1691b977a9ce
claude/docs-presentations-spreadsheets-7jjsgd	97d14ff2a67e85283b658e4f053b97120fad7373
claude/dreamy-bardeen-y4xflj	e7c89633fee3cd4ad98ad6ab1d4ad936e258a099
claude/due-at-noon-was-untimed	a899197abe02ddb540e6cca700fe88c572eda90e
claude/duetime-midday	d16abf53992513652d42cce526730758f8bbbdd0
claude/eager-dirac-77xwm8	1fbdeea45adcd3130ea5afc0cf6d457fdd7706ab
claude/eager-goodall-glmr0w	16d034536d45b80b47ddf75627ae2f69c8d57f62
claude/ecstatic-hypatia-da3wdn	400b20f3b0f1e4efe6abe55e0a1d7d679856daee
claude/eloquent-pasteur-sr2if1	72f2df0419247dce258809a3b490c8d53a2d18a8
claude/embedded-assistant-layout-iera07	9eb18ffb93dd2d194eec6dad7f475a3265114e5c
claude/epic-cannon-tbbrjb	b8640902e3877bae0c71cb6cd4340e63c210043c
claude/epic-planck-mficqu	6f5e33162f8ee605db2c0fd717ddd4e631b7cafd
claude/erase-reaches-every-store	b274a63ec8e1f80477e988573d0a74fd1cb900b4
claude/exam-default-shape	75614ff58f4d1257d9667d19dd5ec004e3462c45
claude/exciting-hamilton-a3m7x4	7a40f7dec1e0528a574136406e307dacd31ebbcb
claude/expandable-collapsible-tabs-ghsciu	e892f23587f1928443a1ce3ecc2b98993e401b16
claude/fervent-sagan-8nvqn7	078e9a563d5abd4c132ee5276834e114e360f732
claude/festive-pasteur-ia4p1s	09b950f2041329c2f9f1b4d570b2d3c9880f9e4e
claude/fifty-minutes-whatever-the-line-says	b59af38d028a33facf547cb2cc303193fa0668da
claude/file-upload-drop-zone-7lfkf3	47400231d11fd805cd80885da8791fe4edff1b6e
claude/final-is-a-qualifier	349f4d4062103d9b1e2ca9e7774623b7ee6ef776
claude/friendly-knuth-493lyg	6bd06ffac08a5d954da32441fc160cfbc2e5165f
claude/friendly-pasteur-vmh8vo	704c9150210a38030d7efc34b08cce70b8e54b60
claude/function-upload-generation-rmjyr1	2cf1a4fc5b0dbb928b5756101d2afdadf654183e
claude/funny-turing-17mt0y	8ac13d5fa98b816149b6301d170ec508294e5916
claude/gallant-fermat-sq5iqk	a086be1071ddd3038cb1979fa363d7b66411ef74
claude/gallant-johnson-obbzlj	d040b8bd48eb623af6409276940a3a881708dd64
claude/gallant-ride-ixtmsn	b1c3cfda86b314619ceb15b9e3e1badb4e0818f9
claude/gifted-edison-kkz1ut	77e4c6e9942c6c4bd1e97db73679a66107f4258f
claude/github-pages-allowlist-aas8n9	575869692940e6ccd235f5b124681582682ed9c4
claude/gpa-band-high-below-low	e795b049cab73e757f5fc8f9b84ca626ce72245c
claude/gracious-faraday-uou10k	5e145750e72edc66d654b67a70016ab0dff949c3
claude/gracious-heisenberg-xj8836	51fbc090e1daca365ae4b3338b4493d51f4b698d
claude/gracious-meitner-r5h2ir	7faac861289248b87a328dc08433b064908e1f0e
claude/great-allen-36k8pi	0eb046d35249c254fb1922878fde59038da4b7c9
claude/great-bohr-1qbyey	306258b91d65fc80ee057b4f4336d93a79854704
claude/happy-maxwell-po3wn9	95aa2d57bcf5ddc84489ec701a65ca94c07ef290
claude/hours-a-week	5dbffd1fdb2d96c078589f6916dc806439006b3a
claude/ics-export-lines	3b4983c4b77cc9621506de78141265d66cedf722
claude/ics-nested-components	8165e753dd00cffccfc3296c05aa51f268559893
claude/ics-recurrence-exceptions	baedc8d251ace902a4cac623cde2ddb432c51e84
claude/inspiring-gates-5wwd3d	f28112aa1b994c0d2dfd29ea5bc500b5b8c81945
claude/jolly-brown-yd9tqw	c301c98fb9ee8ffff56aa0887a9cc0181028a9d5
claude/keen-fermat-183kwh	79a9978b04a736f13e95008e38d2bd3f67165518
claude/keep-the-version-read	d74a9134e6e5b1dfa08e6737720a2da92a675600
claude/legacy-term-export	efd80713b9b86639a953179855a30f2d7872ee5f
claude/long-word-wrap	2efcd2681bc9e4b8d29a54af75d2d433404c655d
claude/loving-carson-68q6me	8e135742c0a438ce89b14ba36d8bea7e8cbcf284
claude/lucid-clarke-2uge62	9e0418e6f4e0917abd4f7ca823f5a070a8179cb5
claude/lucid-hopper-k2m8vq	5b23b146f40baf9879ffbdde083f4b7e0c60050e
claude/magical-johnson-xcy3pr	23bc0271569b8dc29baa0145ac4e923cc8ed8bb9
claude/magical-mayer-qrf2gb	4bb4f25a177f8aac911e557c41d17520d241f915
claude/map-feature-improvements-jdduvl	bed20dbcbe2fd1f91f3a03f67db7b64dcf1d02d8
claude/map-timer	77ce8fb2f437232acfbc77014742b90d56d78e68
claude/modest-davinci-08z56l	2927be64a6d28250096f20d81f5788a5466a169d
claude/month-panel-appointments	672ba9cc120160a4ba96b0b3f468a488f3bff373
claude/new-session-xh7by4	bcfdcf73b0db001a091843ace25f732f789560d5
claude/on-campus-calendar-formats-86dmad	8286fbce42cd88ba72b78c8abda6900bb842d887
claude/one-credits-line-five-readers	1465fc2d18f0b8386dcc7dcaf5a728f176c6b07f
claude/one-reading-of-a-weight	d4bc5b33fb5ae0e89f3060dc436204eed25a9237
claude/one-zip-limit	e5aede9c992d8a73c626463fc3a7f9003b68fc0f
claude/optimistic-davinci-0n5v7z	e9c7d73d5c839892cf92bbaf081dad7999b6e3e3
claude/own-entries-firstrun	67863351464fea9d71a67705d72b15463bf59cc5
claude/paused-commitments	004527d66a04eb1f510afd3591099923e1a3a478
claude/peaceful-cannon-7iq4u4	c15a401c6d37505cae8a6a6c6f8efbb7b849aef8
claude/penalty-counted-twice	2851aabde1cbec9910b7c310db9e31131df22bc2
claude/pensive-pasteur-p7xamn	5d57f9c8d5132653b841f1ad7d4d04c41c924ff1
claude/persist-write-failure	47fc41d2be0165658b083a83a044e5d5dc23cdb4
claude/points-are-weights	c0a2106a75311d0210b49da798ddc47cc732fcee
claude/positioning-overlap-fix-2wk9nz	5642c1853f644e9802ab64914dff79a688584754
claude/power-folds-left	1b35286fd612dc8ba80f430dab2f32287643d96e
claude/practical-fermat-a72ta0	9640e3b42d9c72ca2fb18dd6a4f6fd57c8c20a1c
claude/prefers-has-a-test	98214f1610ca814b18d01bb9bd24041944e3635c
claude/print-rows	a1894c2969f08fa4c359f032b60e7c4c29f0fc81
claude/privacy-storage-reads	2202f88cd269afe5fc365223617f723ec58345ec
claude/progress-screen-design-fe8fiy	f6bb758b73a9328312f7fd3766529fab811fa733
claude/progress-settings-redundancy-hbx6oo	11723c248cd95fc0599805cefc6ede945c11863e
claude/quirky-shannon-tt7lla	eb280aeacb4fcd29c00af88ebfe5641a7606323c
claude/readme-counts-derived	2784f92eaac4ded908dc52b43f1d467fe9d2d085
claude/reduce-motion-when-it-cannot-ask	77a5c3482613d386376ffe9f2ab124b40bbd0b65
claude/refresh-branch-list	00470abefd994f5cba5a4cddf52b52738f3752fa
claude/relaxed-feynman-ok9c7h	47a8c6e0c2b8caeeddce9c22296076fadf7ea38f
claude/relaxed-ptolemy-1471yl	87a3682057b43cf48e3527909692adc579e9404f
claude/reminders-know-done	ca1cac707de3d94e52ffd7808a7aa142a83dbceb
claude/remove-bottom-button-aklrvk	74f517828bb0123bd0a2863f1f040a8351593513
claude/remove-files-mail-button-sgtsox	0866ac36861f645ec56f23086fa80f3c9f86dd1f
claude/remove-places-tab-6z2b03	854cd944e565a7847c6f69ce2748fd6bc53c6269
claude/remove-redundant-search-bar-n4u7u9	2d4ed42b1098bc218f6ac084444f46d8117da1a3
claude/responsive-design-layouts-ghsvzi	74a30da87d68cff99b6fdd915c27ff6205bf7c25
claude/revise-tab-improvements-u09ik2	846f6eb7c656b864e3171f5c1cf51b1aae66b6e3
claude/route-percent	0ff6e71f0b9254a86cdc44927bea83d5090a8ddd
claude/says-it-only-looked-once	18283c09adf33e94b56c5054627b58abdc5e19fa
claude/search-appointments	7cc4d8b41fdaf608c12ed224c9588a4b6db7e383
claude/semester-audit-verdict-i9ak6t	abb52272023a4bb33133f809bdb280fb90fb33f3
claude/serene-brown-q9r1r4	eeacab4558460406d046c082617e55ccddc21e65
claude/sharp-wright-meuqns	ed17e4441667e218896bd1eded06911c4f3973c3
claude/sleepy-galileo-m0c056	8cf862c437452e7bbf574591cd0fe6b2b2acbe83
claude/solve-photo-cap	040a0f519a046d60245bc7f0061c08aff8fcbc51
claude/splash-screen-transition-72whnz	f5bb41b424c290d86734ba317a2c2299152fe9f2
claude/stacked-untimed	c7a9f92159c39e1f450304127aa66f1b47e1ce24
claude/stale-branch-cleanup	d0bdc2029d45d8a40e0ef32ca57254a099c7b7c8
claude/sweet-dijkstra-wfhth2	0e89f0ee7b6d70273bd59cd7d59219e296d31cbc
claude/tasks-calendar-formats-56lzd1	8e5d624d24f7f3ca59e1f4070f06ffde752109fe
claude/the-end-of-a-span-unguarded	17aef2911ca1181aa42f2be00616fe70fee052aa
claude/the-us-position-is-not-a-new-sentence	a12202e747479704531c8dbbba975f5616417635
claude/timetable-appointments	ff15a3914282a6eba0f14f5f080838856ca1ac25
claude/tonight-hours	30760462e6a13234197978e4c4d2a0c0098917f4
claude/tools-tab-home-screen-za9vbp	f67731a13fc0f5438c9c15b80283d7f305baac07
claude/unreal-dates	3dbd7696ca1c35437985ac2e35a5f0020e80c29f
claude/upbeat-carson-cf4zhw	69c6bd2ac6978a9fe2596da79e758a3c4f372784
claude/upbeat-euler-z3jdhr	f8eea9aee40f3753f84215b4904cfa4fcb1eaa94
claude/user-friendliness-usability-accessibility-ka3wnm	fb9e14f1edab6893c48dc4d454043d1167f73407
claude/user-signup-feature-u3umji	1f636acf9446abdcf9625446f9e7e89a44a9938e
claude/vibrant-noether-qroxaa	99318bac5e5f986f24887d93ee2da20e96831daf
claude/walk-to-a-place	45caeb9da88fd73fc80f255abc319b48dd9651ed
claude/week-counts-done	ec612efd8e6f119c16e0618e20569b5200d1c4f4
claude/which-synonym-actually-matched	ad73643c22c83753bb8a0039a578ea7093848b11
claude/wonderful-johnson-q1q9q3	714c90fb12880e43bcffc407eb1556afa7c96954
claude/wonderful-mccarthy-7ccv0i	70c35f5c25e71fb9193d38f99239324a19a46a0f
claude/you-screen-progress-improvements-myb3v7	5dcd1f9b7a34727bf2b65b8b8eff897e5a073379
claude/youthful-feynman-xmk0p4	6faed8277a60f4505bbf1dd9a38f91456b757bd8
claude/youthful-hypatia-4m403d	b023d5851438f407e77f4fe86dbf0fee48446fb7
"

# ── ORPHANED ─────────────────────────────────────────────────────────────
#
# Six branches no pull request of their own ever landed. They are deleted too,
# but deliberately rather than as merged work, and the SHA beside each is the
# whole of the record that they existed:
#
#     git push origin <sha>:refs/heads/<branch>
#
# They are not one kind of thing, and the differences are the point:
#
#   claude/app-review-improvements-7i2aaq   #109 closed unmerged, 51 commits
#     past main. Its tip's patch-id is IDENTICAL to c6d10173 on main, which
#     landed as #140 from claude/db-open-timeout — the same fix written twice
#     by two sessions, one of which was closed. Nothing is lost.
#
#   claude/remove-duplicate-tabs-k3m9       no pull request, ever. Its tip is
#     an ancestor of main, so nothing is lost. This is the branch only check 2
#     can clear: with no pull request there is nothing for GitHub to say.
#
#   claude/calendar-subscribe-message       #147 closed unmerged, 1 commit.
#   claude/readme-screen-count-fifty        #74 closed unmerged, 1 commit.
#     Neither commit is in main in any form.
#
#   claude/app-ux-calendar-refactor-hb7cwr  #92 closed unmerged, 1 commit.
#   claude/draggable-elements-app-8cm3zv    #93 closed unmerged, 1 commit.
#     New to this pass; see the note at the top. Each is a fix for a main that
#     went red on 9 September, closed because the breakage was fixed by
#     somebody else first. Both were in the delete list until now.
#
ORPHANED="
claude/app-review-improvements-7i2aaq	6d606e8d7b5f1c3b80af9dc69bfafce439fc0873
claude/calendar-subscribe-message	21c99fe8af1b6c1353855199f80cb71466036343
claude/readme-screen-count-fifty	9fcbade527a3d03f737b5cdaa7622bf0290de0a2
claude/remove-duplicate-tabs-k3m9	6006767d0cefcfa5530555332a228132c4c1d13a
claude/app-ux-calendar-refactor-hb7cwr	22ec4a515f10df903ba12737e3748ccba7e0795e
claude/draggable-elements-app-8cm3zv	926c6668e186c1621fb49151537b0a336000b675
"

# ── STRAY ────────────────────────────────────────────────────────────────
#
# Not a claude/* branch and not anybody's work: a diagnostic ref, left on the
# remote because the thing it was diagnosing is the thing that would remove it.
#
# Branch deletion is blocked from an agent session. A delete refspec has its
# connection severed — "send-pack: unexpected disconnect while reading sideband
# packet" — across both `--delete` and `:refs/heads/x`, with push.negotiate off,
# every time. It is specific to deletes: creating a branch, pushing a commit and
# merging a pull request all work from the same session, and the egress proxy
# records no denial, so it is not an egress policy and not a credential.
#
# This ref exists because that was established on a throwaway rather than on one
# of the 177 branches below — which was the right way round, but it does mean the
# probe cannot clean itself up. Its tip is an ancestor of main, so there is
# nothing on it to lose.
#
# If you are running this script from a checkout where deletion works, it goes
# with the rest. If this section is still here on a later regeneration, check
# whether the ref is actually gone before copying it forward.
#
STRAY="
tmp/delete-probe-5291	1bae34decbcc23b422db017c85a883cf25ce44cc
"

git fetch origin

deleted=0; skipped=0; moved=0; failed=()

while read -r br want; do
  [ -z "$br" ] && continue
  have=$(git rev-parse --verify --quiet "origin/$br" 2>/dev/null || true)
  if [ -z "$have" ]; then
    echo "gone already:   $br"
    skipped=$((skipped + 1))
    continue
  fi
  if [ "$have" != "$want" ]; then
    echo "MOVED, skipping: $br  (expected ${want:0:9}, found ${have:0:9})" >&2
    moved=$((moved + 1))
    continue
  fi
  if git push origin --delete "$br"; then
    deleted=$((deleted + 1))
  else
    failed+=("$br")
  fi
done <<< "$BRANCHES$ORPHANED$STRAY"

echo
echo "deleted $deleted, already gone $skipped, moved since listing $moved, failed ${#failed[@]}"
if [ ${#failed[@]} -gt 0 ]; then
  printf 'failed to delete: %s\n' "${failed[@]}" >&2
fi
echo
[ ${#failed[@]} -eq 0 ] || exit 1
