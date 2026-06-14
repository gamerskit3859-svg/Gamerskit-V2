export default function AdminLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-20 rounded bg-line" />
        <div className="mt-3 h-9 w-56 rounded bg-line" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-line" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-lg border border-line bg-white"
          />
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-line bg-white p-4">
        <div className="h-5 w-36 rounded bg-line" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="grid grid-cols-4 gap-4">
              <div className="col-span-2 h-4 rounded bg-line" />
              <div className="h-4 rounded bg-line" />
              <div className="h-4 rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
