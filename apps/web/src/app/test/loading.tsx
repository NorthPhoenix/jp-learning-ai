export default function Loading() {
  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Test Page</h1>
      <div className="rounded bg-gray-100 p-4">
        <div className="animate-pulse">
          <div className="h-4 w-3/4 rounded bg-gray-300"></div>
        </div>
      </div>
    </div>
  )
}
