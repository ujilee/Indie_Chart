import Link from "next/link";
import { AdminHeader, Card } from "@/components/ui";
import ArtistForm from "../ArtistForm";

export default function NewArtist() {
  return (
    <>
      <Link href="/artists" className="text-sm text-muted hover:text-fg">
        ‹ 아티스트 목록
      </Link>
      <div className="mt-3">
        <AdminHeader title="아티스트 등록" desc="Spotify에 등록된 국내 인디 아티스트만 등록할 수 있어요." />
      </div>
      <Card className="max-w-3xl">
        <ArtistForm />
      </Card>
    </>
  );
}
