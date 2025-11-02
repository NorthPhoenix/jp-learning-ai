import { api } from "~/trpc/server"

export default async function TestPage() {
  const data = await api.post.hello()

  return (
    <div className="p-8">
      <h1 className="mb-4 text-2xl font-bold">Test Page</h1>
      <div className="rounded bg-gray-100 p-4">
        <p>{data.greeting}</p>
      </div>
    </div>
  )
}
