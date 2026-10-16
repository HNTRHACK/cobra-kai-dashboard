import type { Metadata } from "next";
import { getCompetition, getSignalFiles, getWindow } from "@/lib/data";
import { Note, PageHero } from "@/components/ui/primitives";
import SignalExplorer from "@/components/charts/SignalExplorer";

export const metadata: Metadata = { title: "Trading signals" };

export default function SignalsPage() {
  const files = getSignalFiles();
  const window = getWindow();
  const v2 = getCompetition().round3Uploads.find((u) => u.label === "V2");
  return (
    <>
      <PageHero
        n={4}
        kicker="Trading signals · 851–900"
        title="Fifty decisions,"
        accent="one at a time."
        meta={`${files.length} files · recomputed from CSV`}
        lede={<>Inspect every position in the three Round 3 files. Long, short and flat counts, exposure and turnover are recomputed from the CSVs at build time, and each file is checked against the submission format.</>}
      />
      <SignalExplorer files={files} window={window} />
      {v2 && <Note>V2 · {v2.note}</Note>}
    </>
  );
}
