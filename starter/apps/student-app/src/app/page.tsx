import Link from "next/link";

export default function HomePage() {
  return (
    <main>
      <h1>Semester</h1>
      <p>
        <Link href="/app/today">Today</Link>
      </p>
    </main>
  );
}
