import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Property, TourStatus } from "@/lib/types/property";
import { publicPhotoUrl } from "@/components/photo-url";

const STATUS_LABEL: Record<TourStatus, string> = {
  not_toured: "Not toured",
  scheduled: "Scheduled",
  toured: "Toured",
  rejected: "Rejected",
  top_pick: "Top pick",
};

export default async function ComparePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("properties")
    .select("*")
    .order("created_at", { ascending: false });
  const properties = (data ?? []) as Property[];

  return (
    <main className="p-6">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-semibold">Compare</h1>
        <Link href="/" className="text-sm border rounded px-3 py-2">
          ← Back to map
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-2">Photo</th>
              <th className="p-2">Address</th>
              <th className="p-2">Price</th>
              <th className="p-2">Bd/Ba</th>
              <th className="p-2">Sqft</th>
              <th className="p-2">Status</th>
              <th className="p-2">Rating</th>
              <th className="p-2">Top pros</th>
              <th className="p-2">Top cons</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="p-2">
                  {p.photo_path ? (
                    <img
                      src={publicPhotoUrl(p.photo_path)}
                      alt=""
                      className="w-16 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-200 rounded" />
                  )}
                </td>
                <td className="p-2">
                  <Link
                    href={`/properties/${p.id}`}
                    className="hover:underline"
                  >
                    {p.address}
                  </Link>
                </td>
                <td className="p-2">
                  {p.price ? `$${p.price.toLocaleString()}` : "—"}
                </td>
                <td className="p-2">
                  {p.beds ?? "—"}/{p.baths ?? "—"}
                </td>
                <td className="p-2">{p.square_feet ?? "—"}</td>
                <td className="p-2">{STATUS_LABEL[p.tour_status]}</td>
                <td className="p-2">
                  {p.star_rating ? "★".repeat(p.star_rating) : "—"}
                </td>
                <td className="p-2 text-green-700">
                  <ul className="list-disc list-inside">
                    {p.pros.slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </td>
                <td className="p-2 text-red-700">
                  <ul className="list-disc list-inside">
                    {p.cons.slice(0, 3).map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
