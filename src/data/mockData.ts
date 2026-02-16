export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: string;
  coverUrl: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  imageUrl: string;
  category: string;
}

export interface Category {
  id: string;
  name: string;
  imageUrl: string;
}

export interface GameLevel {
  id: string;
  level: number;
  title: string;
  quizCount: number;
  completed: boolean;
  locked: boolean;
}

export const topSongs: Song[] = [
  { id: "1", title: "None Like You", artist: "Loveworld Singers", album: "Worship Collection", duration: "4:32", coverUrl: "" },
  { id: "2", title: "I Am What He Says I Am", artist: "Pastor Chris", album: "Declaration", duration: "5:10", coverUrl: "" },
  { id: "3", title: "Righteous One", artist: "Sinach", album: "Way Maker", duration: "3:45", coverUrl: "" },
  { id: "4", title: "This Is My Season", artist: "Loveworld Singers", album: "Season of Glory", duration: "4:18", coverUrl: "" },
  { id: "5", title: "Blessed Assurance", artist: "CSO", album: "Hymns Reloaded", duration: "6:02", coverUrl: "" },
  { id: "6", title: "The Name of Jesus", artist: "Eben", album: "Praise Night", duration: "3:55", coverUrl: "" },
];

export const featuredSongs: Song[] = [
  { id: "7", title: "More Than A Song", artist: "Testimony Jaga", album: "Glory", duration: "4:45", coverUrl: "" },
  { id: "8", title: "You Are Good", artist: "Israel Houghton", album: "Live Worship", duration: "5:20", coverUrl: "" },
  { id: "9", title: "Hallelujah", artist: "Loveworld Orchestra", album: "Orchestral Praise", duration: "7:10", coverUrl: "" },
  { id: "10", title: "Pour Out Your Spirit", artist: "Sinach", album: "Waymaker", duration: "5:30", coverUrl: "" },
];

export const categories: Category[] = [
  { id: "1", name: "Praise & Worship", imageUrl: "" },
  { id: "2", name: "Salvation", imageUrl: "" },
  { id: "3", name: "Healing", imageUrl: "" },
  { id: "4", name: "Medleys", imageUrl: "" },
  { id: "5", name: "Orchestra", imageUrl: "" },
  { id: "6", name: "Choral", imageUrl: "" },
  { id: "7", name: "Communion", imageUrl: "" },
  { id: "8", name: "Christmas", imageUrl: "" },
];

export const articles: Article[] = [
  { id: "1", title: "The Power of Praise in Your Daily Walk", excerpt: "Discover how praise transforms your spiritual journey and brings you closer to God's purpose.", author: "Pastor Chris", date: "Feb 15, 2026", imageUrl: "", category: "Devotional" },
  { id: "2", title: "Understanding the Lyrics: A Deeper Study", excerpt: "Go beyond the melody and understand the prophetic declarations in worship songs.", author: "Deacon Ruth", date: "Feb 14, 2026", imageUrl: "", category: "Study" },
  { id: "3", title: "Music as a Gateway to the Spirit", excerpt: "How music opens the door to deeper spiritual experiences and divine encounters.", author: "Pastor Chris", date: "Feb 13, 2026", imageUrl: "", category: "Teaching" },
];

export const gameLevels: GameLevel[] = [
  { id: "1", level: 1, title: "Beginner Worshipper", quizCount: 10, completed: true, locked: false },
  { id: "2", level: 2, title: "Rising Praise", quizCount: 10, completed: false, locked: false },
  { id: "3", level: 3, title: "Worship Leader", quizCount: 10, completed: false, locked: true },
  { id: "4", level: 4, title: "Praise Champion", quizCount: 10, completed: false, locked: true },
  { id: "5", level: 5, title: "Master of Worship", quizCount: 10, completed: false, locked: true },
];
