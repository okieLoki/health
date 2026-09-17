/**
 * Loading shapes.
 *
 * Every tab is server rendered against a database in another region, so a
 * navigation is never instant. Painting the page's skeleton immediately turns
 * a frozen tap into a responsive one, which matters more than the few hundred
 * milliseconds underneath it.
 */
function Bar({ w = "100%", h = 12, r = 6 }: { w?: string | number; h?: number; r?: number }) {
  return <span className="skeleton block" style={{ width: w, height: h, borderRadius: r }} />;
}

function Card({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-[26px] border border-[var(--hairline)] bg-[var(--surface)] p-5">
      {children}
    </div>
  );
}

function Tiles({ n, cols }: { n: number; cols: number }) {
  return (
    <div className={`grid gap-3 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-[24px] bg-[var(--surface-2)] p-4">
          <Bar w={54} h={11} />
          <div className="mt-3.5" />
          <Bar w={72} h={22} r={8} />
          <div className="mt-2" />
          <Bar w={48} h={10} />
        </div>
      ))}
    </div>
  );
}

/** Big number, a panel, then tiles. Matches Today, Body, Train, You and Food. */
export function PageSkeleton({
  tiles = 4,
  cols = 2,
  rows = 2,
}: {
  tiles?: number;
  cols?: number;
  rows?: number;
}) {
  return (
    <main className="min-w-0 flex-1 px-5 pb-28 pt-5 lg:px-8 lg:pb-12 lg:pt-8" aria-busy="true">
      <div className="mx-auto max-w-2xl">
        <Bar w={120} h={13} />
        <div className="mt-5" />
        <Bar w={220} h={58} r={14} />
        <div className="mt-4" />
        <Bar w={150} h={13} />

        <div className="mt-6" />
        <Card>
          <Bar w={90} h={22} r={8} />
          <div className="mt-4" />
          <Bar h={7} r={99} />
          <div className="mt-4" />
          <Bar w="70%" h={11} />
        </Card>

        {tiles > 0 && (
          <>
            <div className="mt-3" />
            <Tiles n={tiles} cols={cols} />
          </>
        )}

        <div className="mt-3 space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <Card key={i}>
              <Bar w={110} h={15} r={7} />
              <div className="mt-4" />
              <Bar h={11} />
              <div className="mt-2.5" />
              <Bar w="80%" h={11} />
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}

/** A thread of bubbles, so Ask does not flash an empty screen. */
export function ChatSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-5 lg:px-8 lg:pt-8" aria-busy="true">
      <div className="mx-auto w-full max-w-2xl">
        <Bar w={70} h={28} r={9} />
        <div className="mt-3" />
        <Bar w={240} h={13} />
        <div className="mt-8 flex flex-col gap-5">
          {[
            { end: true, w: "58%" },
            { end: false, w: "82%" },
            { end: true, w: "44%" },
          ].map((m, i) => (
            <div key={i} className={`flex ${m.end ? "justify-end" : "justify-start"}`}>
              <span className="skeleton block" style={{ width: m.w, height: 44, borderRadius: 22 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
