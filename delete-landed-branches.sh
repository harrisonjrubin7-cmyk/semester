#!/usr/bin/env bash
#
# Delete the claude/* branches whose work has landed in main.
#
# 152 claude/* branches: 145 here, 3 excluded for having an open pull
# request, and 4 that no pull request ever landed — those carry their own
# note below.
#
# Regenerated 2026-09-15 01:59 UTC against main @ 0deea0e7. The counts move
# fast. One branch read as open at the start of this regeneration and as merged
# by the end of it; two more pull requests opened in between; and a dry run
# fifteen minutes after the SHAs were captured already found four of them
# moved. So treat the SHAs as the authority and the numbers in this comment as
# the day they were written.
#
# The SHAs are deliberately NOT refreshed to the moment of committing. They are
# pinned to the moment each branch was classified, which is the only moment
# they mean anything: re-pinning a branch to a commit nobody has looked at
# would hand the guard below a fact it cannot check, which is the one thing it
# exists to stop.
#
# ── Why the list is pinned to SHAs ────────────────────────────────────────
#
# The first version of this script re-checked each branch with `git merge-tree`
# at run time: merge it into main, and if nothing changes the branch adds
# nothing. That test is right about the branches it clears, and wrong about a
# large class it does not.
#
# It asks "would merging this change main?", which is not the same question as
# "does this branch hold work main lacks". Once main moves PAST a merged
# branch — a later commit edits the same file — merging the old branch back
# would revert that later work, so merge-tree reports a change and the branch
# reads as unmerged. `claude/stale-branch-cleanup` is the proof: its pull
# request merged, a second pull request then edited the same file, and the
# check flagged it as carrying unmerged work twenty minutes later. It carries
# none.
#
# What clears them instead is GitHub: each branch below is the head of at least
# one pull request that is merged, which is authoritative about the work having
# landed in a way that reading trees is not.
#
# So the run-time guard is different. Every branch is pinned to the commit it
# pointed at when this list was made, and a branch is deleted only if it still
# points there. A branch that has taken a commit since is a branch whose new
# commit nobody has classified, so it is skipped and named. That guard is what
# makes a stale list safe: this repo moves fast enough that several branches
# changed during the few minutes it took to write this.
#
# ── How this list was rebuilt ─────────────────────────────────────────────
#
# Every pull request in the repository was paged through, and each of the 152
# branches classified by what its own pull requests say:
#
#   · a merged one, and no open one  →  deleted below
#   · an open one                    →  excluded, however many merged ones it
#                                       also has
#   · no merged one at all           →  ORPHANED, at the bottom
#
# The three excluded for an open pull request:
#
#     claude/beautiful-noether-3q3r5e
#     claude/brave-hamilton-luax4r
#     claude/quirky-shannon-tt7lla
#
# That set was re-read at the end rather than taken from the same pass as the
# rest, because it moved while this ran: one branch was open on the first page
# and merged by the last, and two more pull requests opened in between. The
# open set is the one place a stale reading would cost something — it is what
# keeps a live branch off the list — so it is the one place worth asking twice.
#
# Note that `merged` comes back false on every pull request in a list
# response; only `merged_at` is populated. A classification built on the
# boolean would have read all 413 as unmerged and this file would be empty.
#
# The previous list was built the same way and named the same four orphans,
# which is the check on both: two passes, days apart, agreeing about which
# branches no pull request ever landed.
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
claude/affectionate-brown-tgqjrb	cb7c63e3d79cebb15896a926859733c2e8471eb8
claude/also-functionality-1606uu	6e5f10797d3828b03aad6b23d73664159128b9d9
claude/api-key-integration-2vzsxh	8b09710c49050b2160d74f6930cdfba86597a01b
claude/app-ai-integration-gbhm8z	8fd2704c833da28e0133d48309af51cd9a5f3aa4
claude/app-audit-cleanup-po2tdp	1f662b2036272ce0331894e61fac3686e8881f73
claude/app-capabilities-expansion-3t1zbt	a691f1c6f76cd02ada54c2427cc8f90da9f86cb1
claude/app-design-code-review-8zh4px	d3830e7339532a6933cb685cf00aa19ceb406375
claude/app-design-review-dgqbe2	004aad35509b8712800a4a74cc9f3edd5a195d74
claude/app-functionality-review-twdu6o	ef7a7d2d09ab41640690e01db6982970a5ed5eb5
claude/app-functionality-ux-review-j14m1t	012013315b39c272c2b6dd3d9b92960654dca98f
claude/app-launcher-icon-menu-l4ex6q	e51a83aa901a843021fe199dd272af51d79e070e
claude/app-refactor-streamline-7xk5wk	9be22e19322c4167f8632d664d463209b8f2d284
claude/app-usability-review-e6y92d	542df586316365739fe2f9af72fcdccecfac1ab6
claude/app-ux-calendar-refactor-hb7cwr	22ec4a515f10df903ba12737e3748ccba7e0795e
claude/app-wide-improvements-cs8l9l	8b21a7c07a00a5f2eaf0ef14367ab867d27d58be
claude/ask-claude-mobile-layout-ss2cfd	ede5e24eb3bad7b2b83e6c34116d9a633f30365b
claude/assistant-blind-to-feeds	f754074a275f971404db9f8a4786ae61e5359fce
claude/assistant-cut-stream	5553105bf8e4b4a2866e1b4c1a848949bc6bc666
claude/awesome-rubin-63w34j	001c1251b3fcb19a1bc1bc6fed1a74ffef0d891d
claude/backup-feeds	51733a6b6989562ac42e69539214e21cc6082ad6
claude/bibtex-escapes	43fad71814cab924266b504059d86f6c699c11a1
claude/bold-carson-rwo974	eaa27dd625032c8e8afd50d21909d92de57944cc
claude/bold-fermat-089zmf	b0cfa406fa4f1deb68a8114a29d6448d1255ba17
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
claude/db-open-timeout	a78224c1a147c8b8def5506df3646c565d9b0e5c
claude/delete-landed-branches	6c43213ba19a105c202067a596e458da555fa2e9
claude/delete-orphan-history	3ba1990abe4220e395916f3976e6319949e64359
claude/determined-hopper-15h6vp	7b173f687f24cffe574a2ce0b6ea1691b977a9ce
claude/docs-presentations-spreadsheets-7jjsgd	97d14ff2a67e85283b658e4f053b97120fad7373
claude/draggable-elements-app-8cm3zv	926c6668e186c1621fb49151537b0a336000b675
claude/dreamy-bardeen-y4xflj	e7c89633fee3cd4ad98ad6ab1d4ad936e258a099
claude/due-at-noon-was-untimed	a899197abe02ddb540e6cca700fe88c572eda90e
claude/duetime-midday	d16abf53992513652d42cce526730758f8bbbdd0
claude/eager-goodall-glmr0w	a325a1ff64a162746caa7412484a02ad6f8a8c37
claude/embedded-assistant-layout-iera07	9eb18ffb93dd2d194eec6dad7f475a3265114e5c
claude/epic-cannon-tbbrjb	b8640902e3877bae0c71cb6cd4340e63c210043c
claude/epic-planck-mficqu	6f5e33162f8ee605db2c0fd717ddd4e631b7cafd
claude/erase-reaches-every-store	b274a63ec8e1f80477e988573d0a74fd1cb900b4
claude/exam-default-shape	75614ff58f4d1257d9667d19dd5ec004e3462c45
claude/expandable-collapsible-tabs-ghsciu	e892f23587f1928443a1ce3ecc2b98993e401b16
claude/fervent-sagan-8nvqn7	078e9a563d5abd4c132ee5276834e114e360f732
claude/fifty-minutes-whatever-the-line-says	b59af38d028a33facf547cb2cc303193fa0668da
claude/file-upload-drop-zone-7lfkf3	47400231d11fd805cd80885da8791fe4edff1b6e
claude/final-is-a-qualifier	349f4d4062103d9b1e2ca9e7774623b7ee6ef776
claude/friendly-knuth-493lyg	762ee928640e1b459f14c48a5b6e0747ab4ba745
claude/function-upload-generation-rmjyr1	2cf1a4fc5b0dbb928b5756101d2afdadf654183e
claude/gallant-johnson-obbzlj	315dec68d2971a5b4439f6961f167663d62b9551
claude/github-pages-allowlist-aas8n9	575869692940e6ccd235f5b124681582682ed9c4
claude/gpa-band-high-below-low	e795b049cab73e757f5fc8f9b84ca626ce72245c
claude/gracious-faraday-uou10k	5e145750e72edc66d654b67a70016ab0dff949c3
claude/gracious-heisenberg-xj8836	51fbc090e1daca365ae4b3338b4493d51f4b698d
claude/gracious-meitner-r5h2ir	5c10b047d97e9e911da0032b61f4a5aea45eafca
claude/great-allen-36k8pi	0eb046d35249c254fb1922878fde59038da4b7c9
claude/great-bohr-1qbyey	ea9a1f8e10610080de3c946a73d060a90ab75d6a
claude/happy-maxwell-po3wn9	95aa2d57bcf5ddc84489ec701a65ca94c07ef290
claude/hours-a-week	5dbffd1fdb2d96c078589f6916dc806439006b3a
claude/ics-export-lines	3b4983c4b77cc9621506de78141265d66cedf722
claude/ics-nested-components	8165e753dd00cffccfc3296c05aa51f268559893
claude/ics-recurrence-exceptions	baedc8d251ace902a4cac623cde2ddb432c51e84
claude/inspiring-gates-5wwd3d	f28112aa1b994c0d2dfd29ea5bc500b5b8c81945
claude/keep-the-version-read	d74a9134e6e5b1dfa08e6737720a2da92a675600
claude/legacy-term-export	efd80713b9b86639a953179855a30f2d7872ee5f
claude/long-word-wrap	2efcd2681bc9e4b8d29a54af75d2d433404c655d
claude/lucid-clarke-2uge62	9e0418e6f4e0917abd4f7ca823f5a070a8179cb5
claude/magical-johnson-xcy3pr	b0cfa406fa4f1deb68a8114a29d6448d1255ba17
claude/magical-mayer-qrf2gb	90ca32828e6480db2f64dd6449f18f941760b2f0
claude/map-feature-improvements-jdduvl	bed20dbcbe2fd1f91f3a03f67db7b64dcf1d02d8
claude/map-timer	77ce8fb2f437232acfbc77014742b90d56d78e68
claude/modest-davinci-08z56l	2927be64a6d28250096f20d81f5788a5466a169d
claude/month-panel-appointments	672ba9cc120160a4ba96b0b3f468a488f3bff373
claude/new-session-xh7by4	bcfdcf73b0db001a091843ace25f732f789560d5
claude/on-campus-calendar-formats-86dmad	8286fbce42cd88ba72b78c8abda6900bb842d887
claude/one-credits-line-five-readers	1465fc2d18f0b8386dcc7dcaf5a728f176c6b07f
claude/one-reading-of-a-weight	d4bc5b33fb5ae0e89f3060dc436204eed25a9237
claude/one-zip-limit	e5aede9c992d8a73c626463fc3a7f9003b68fc0f
claude/own-entries-firstrun	67863351464fea9d71a67705d72b15463bf59cc5
claude/paused-commitments	004527d66a04eb1f510afd3591099923e1a3a478
claude/peaceful-cannon-7iq4u4	c15a401c6d37505cae8a6a6c6f8efbb7b849aef8
claude/penalty-counted-twice	2851aabde1cbec9910b7c310db9e31131df22bc2
claude/pensive-pasteur-p7xamn	5d57f9c8d5132653b841f1ad7d4d04c41c924ff1
claude/persist-write-failure	47fc41d2be0165658b083a83a044e5d5dc23cdb4
claude/points-are-weights	c0a2106a75311d0210b49da798ddc47cc732fcee
claude/positioning-overlap-fix-2wk9nz	5642c1853f644e9802ab64914dff79a688584754
claude/power-folds-left	1b35286fd612dc8ba80f430dab2f32287643d96e
claude/practical-fermat-a72ta0	f39d3fd41af8bac173220c19982ae2dea5e71592
claude/prefers-has-a-test	98214f1610ca814b18d01bb9bd24041944e3635c
claude/print-rows	a1894c2969f08fa4c359f032b60e7c4c29f0fc81
claude/privacy-storage-reads	2202f88cd269afe5fc365223617f723ec58345ec
claude/progress-screen-design-fe8fiy	f6bb758b73a9328312f7fd3766529fab811fa733
claude/progress-settings-redundancy-hbx6oo	11723c248cd95fc0599805cefc6ede945c11863e
claude/readme-counts-derived	2784f92eaac4ded908dc52b43f1d467fe9d2d085
claude/reduce-motion-when-it-cannot-ask	77a5c3482613d386376ffe9f2ab124b40bbd0b65
claude/refresh-branch-list	00470abefd994f5cba5a4cddf52b52738f3752fa
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
claude/serene-brown-q9r1r4	0db5ed6e663f525d6c6db198bb55de2ca84bfbc9
claude/sharp-wright-meuqns	ed17e4441667e218896bd1eded06911c4f3973c3
claude/sleepy-galileo-m0c056	8cf862c437452e7bbf574591cd0fe6b2b2acbe83
claude/solve-photo-cap	040a0f519a046d60245bc7f0061c08aff8fcbc51
claude/splash-screen-transition-72whnz	f5bb41b424c290d86734ba317a2c2299152fe9f2
claude/stacked-untimed	c7a9f92159c39e1f450304127aa66f1b47e1ce24
claude/stale-branch-cleanup	d0bdc2029d45d8a40e0ef32ca57254a099c7b7c8
claude/sweet-dijkstra-wfhth2	c7b6020d015c6313989abbe900cb7fa33d4047ea
claude/tasks-calendar-formats-56lzd1	8e5d624d24f7f3ca59e1f4070f06ffde752109fe
claude/the-end-of-a-span-unguarded	17aef2911ca1181aa42f2be00616fe70fee052aa
claude/the-us-position-is-not-a-new-sentence	a12202e747479704531c8dbbba975f5616417635
claude/timetable-appointments	ff15a3914282a6eba0f14f5f080838856ca1ac25
claude/tonight-hours	30760462e6a13234197978e4c4d2a0c0098917f4
claude/tools-tab-home-screen-za9vbp	f67731a13fc0f5438c9c15b80283d7f305baac07
claude/unreal-dates	3dbd7696ca1c35437985ac2e35a5f0020e80c29f
claude/upbeat-carson-cf4zhw	8e796334b663d104d42d9991d18b7be38392df1e
claude/user-friendliness-usability-accessibility-ka3wnm	fb9e14f1edab6893c48dc4d454043d1167f73407
claude/user-signup-feature-u3umji	1f636acf9446abdcf9625446f9e7e89a44a9938e
claude/vibrant-noether-qroxaa	99318bac5e5f986f24887d93ee2da20e96831daf
claude/walk-to-a-place	45caeb9da88fd73fc80f255abc319b48dd9651ed
claude/week-counts-done	ec612efd8e6f119c16e0618e20569b5200d1c4f4
claude/which-synonym-actually-matched	ad73643c22c83753bb8a0039a578ea7093848b11
claude/you-screen-progress-improvements-myb3v7	5dcd1f9b7a34727bf2b65b8b8eff897e5a073379
"

# ── The 4 that no pull request ever landed ─────────────────────────────────
#
# These are not cleared by the rule above, because there is nothing to clear
# them with. Three are the head of a pull request that was CLOSED without
# merging — #109, #147 and #74 — and the fourth,
# `remove-duplicate-tabs-k3m9`, is the head of no pull request at all.
#
# They are older and smaller than main, last touched 2026-09-09, and each holds
# paths main does not have — pre-refactor names whose concepts survived the
# move, like `components/nav/Launcher.tsx` and `Folder.tsx` for what are now
# `lib/launcher.ts` and `lib/apps.ts`.
#
# So: superseded remnants, not lost work — but that is a judgement from
# reading, not a proof, and it is the reason the SHAs below matter more than
# the ones above. Restoring one is the same command:
#
#     git push origin <sha>:refs/heads/<branch>
#
ORPHANED="
claude/app-review-improvements-7i2aaq	6d606e8d7b5f1c3b80af9dc69bfafce439fc0873
claude/calendar-subscribe-message	21c99fe8af1b6c1353855199f80cb71466036343
claude/readme-screen-count-fifty	9fcbade527a3d03f737b5cdaa7622bf0290de0a2
claude/remove-duplicate-tabs-k3m9	6006767d0cefcfa5530555332a228132c4c1d13a
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
done <<< "$BRANCHES$ORPHANED"

echo
echo "deleted $deleted, already gone $skipped, moved since listing $moved, failed ${#failed[@]}"
if [ ${#failed[@]} -gt 0 ]; then
  printf 'failed to delete: %s\n' "${failed[@]}" >&2
fi
echo
[ ${#failed[@]} -eq 0 ] || exit 1
