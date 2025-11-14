import AuthButtons from "@/components/AuthButtons";
import Link from "next/link";

export default function Page() {
  return (
    <main className="p-6">
      <AuthButtons />
      <Link href="/today" >
      <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Go to Calendar
      </button>
      </Link>
    </main>
  );
}