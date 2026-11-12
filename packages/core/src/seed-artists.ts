/**
 * 시드 아티스트: 실제 국내 인디 아티스트와 Spotify 아티스트 ID.
 * Spotify ID는 oEmbed로, 멜론 ID는 2026-11-10 멜론 인디 일간 차트로 확인했고, image는 그때 받은 Spotify 프로필 썸네일(320px).
 * 순위·수치·공연·응원 등 나머지 시드 데이터는 목업이다.
 */
export interface SeedArtist {
  name: string;
  nameEn: string;
  genre: string;
  spotify: string;
  /** 멜론 아티스트 ID (멜론 인디 차트에서 확인한 경우) */
  melon?: string;
  image?: string;
}

export const SEED_ARTISTS: SeedArtist[] = [
  { name: "잔나비", nameEn: "JANNABI", genre: "인디록", spotify: "029eDTVq16CoBaQmrT1ugA", melon: "772253", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174776565cc2d97c46f4d000134" },
  { name: "혁오", nameEn: "HYUKOH", genre: "얼터너티브", spotify: "57okaLdCtv3nVBSn5otJkp", melon: "785589", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517441b9c661941c1262a340bfc3" },
  { name: "실리카겔", nameEn: "Silica Gel", genre: "사이키델릭록", spotify: "2kxVxKOgoefmgkwoHipHsn", melon: "883187", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517413400fbc8e055088b5acf81b" },
  { name: "새소년", nameEn: "SE SO NEON", genre: "인디록", spotify: "07OePkse2fcvU9wlVftNMl", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517427781ac76c7bb43ec6c7d4b2" },
  { name: "검정치마", nameEn: "The Black Skirts", genre: "인디록", spotify: "6WeDO4GynFmK4OxwkBzMW8", melon: "276166", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051748609536d21beed6769d09d7f" },
  { name: "너드커넥션", nameEn: "Nerd Connection", genre: "모던록", spotify: "5WKUZJPvN1SScyggtPFShK", melon: "2243398", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051741bbcb5844b6855c332e40ad9" },
  { name: "데이먼스 이어", nameEn: "Damons year", genre: "인디팝", spotify: "2T5KKZuEEudb7alCJ1pCus", melon: "1757393", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174341c85848c698e505bb967b4" },
  { name: "아도이", nameEn: "ADOY", genre: "신스팝", spotify: "64sY7LsUjNE3ifONkftTXC", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051744ef0229dda02309cc2c464da" },
  { name: "한로로", nameEn: "HANRORO", genre: "인디록", spotify: "5wVJpXzuKV6Xj7Yhsf2uYx", melon: "3080810", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051742b1eca3debf68d26f7f25816" },
  { name: "웨이브투어스", nameEn: "wave to earth", genre: "드림팝", spotify: "5069JTmv5ZDyPeZaCCXiCg", melon: "2743599", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517411fa75d331351ecfc2e93faf" },
  { name: "유다빈밴드", nameEn: "YUDABINBAND", genre: "모던록", spotify: "2UjX6FLGyUQb4sbookjR3y", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174e418c02a8003826b64fc513a" },
  { name: "쏜애플", nameEn: "THORNAPPLE", genre: "사이키델릭록", spotify: "6S4fsREHT1NEjTb3lYD2pG", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174a4038578068cd2582c0dccd2" },
  { name: "데이브레이크", nameEn: "DAYBREAK", genre: "모던록", spotify: "1uMhweBMKu7nA1IgFc0yN2", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051746822d68461a20f71e3db2c30" },
  { name: "카더가든", nameEn: "Car, the garden", genre: "인디팝", spotify: "7c1HgFDe8ogy5NOZ1ANCJQ", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174c01f9208391fe683603a0617" },
  { name: "터치드", nameEn: "TOUCHED", genre: "모던록", spotify: "5jgIm8tZ4hqLeoHTo9wJIV", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174ee9af70b9785b78124fad937" },
  { name: "소란", nameEn: "SORAN", genre: "인디팝", spotify: "7eZGd0sv1TxpOwzyKc9P4R", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174b8d46be95578606c361c7102" },
  { name: "페퍼톤스", nameEn: "Peppertones", genre: "모던록", spotify: "4JogM9j9zjR2PQJ0bYS75b", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051741a8335eb603a0276ec9c9698" },
  { name: "장기하와 얼굴들", nameEn: "Kiha & The Faces", genre: "인디록", spotify: "0oN8IZB1C3lY1ABKwJOu1I", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174f99ecf9f9a5e0e62d01b10a6" },
  { name: "브로콜리너마저", nameEn: "Broccoli, you too?", genre: "인디팝", spotify: "1gq4XavqmZhqOzEkpFBz1j", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051747c6a48a91cd0013a8bfb7490" },
  { name: "김사월", nameEn: "Kim Sawol", genre: "포크", spotify: "08J6v4qHZz06ua0qAicWmE", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174a2d0172b4421c469e639ef35" },
  { name: "이날치", nameEn: "LEENALCHI", genre: "얼터너티브", spotify: "0kHgYUOcTac5RhkYx1thsq", image: "https://image-cdn-fa.spotifycdn.com/image/ab676161000051748e30bd9448773f453ea6da28" },
  { name: "술탄 오브 더 디스코", nameEn: "Sultan of the Disco", genre: "디스코", spotify: "2OlCSUqTMqHguyNtdE0mdv", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e0288581be59a542602e59b1c60" },
  { name: "까데호", nameEn: "CADEJO", genre: "사이키델릭록", spotify: "296ryPygSSpdsrZJk2x5Up", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051741d54c529837da5f63845da78" },
  { name: "세이수미", nameEn: "Say Sue Me", genre: "인디록", spotify: "4tvbo17gXpYgSr8sTlkaby", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517412c80e0eb6780a7bdff89695" },
  { name: "9와 숫자들", nameEn: "9 and the Numbers", genre: "인디팝", spotify: "3GtxaQXCwJZaoV9lmKofs0", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051740e8166ed6e0dd1c8ef80dbe9" },
  { name: "짙은", nameEn: "Zitten", genre: "포크", spotify: "3of4z5k152Et4C0IQ7HUAg", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616100005174df3dde724d74da69164518e6" },
  { name: "루시", nameEn: "LUCY", genre: "모던록", spotify: "4eh2JeBpQaScfHKKXZh5vO", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051742cd1196569576dff6dfc70c8" },
  { name: "델리스파이스", nameEn: "Deli Spice", genre: "모던록", spotify: "3zH8Xu8C1GnnmfpBqzdLPf", melon: "100099", image: "https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e029ee364d7aacc7ae61af96b2b" },
  { name: "선우정아", nameEn: "SWJA", genre: "R&B", spotify: "04L3elxyr0XFua2Ek3domW", image: "https://image-cdn-ak.spotifycdn.com/image/ab676161000051742aa9632cbca8989d313f8824" },
  { name: "백예린", nameEn: "Yerin Baek", genre: "R&B", spotify: "6dhfy4ByARPJdPtMyrUYJK", image: "https://image-cdn-ak.spotifycdn.com/image/ab6761610000517436fb1d2c40997cd05363de1f" },
];
