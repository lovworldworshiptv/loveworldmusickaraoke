/**
 * Official web share addresses for each social app, in one place so every share
 * button uses the same, current format.
 * - KingsChat: /share?text= (signs the person in first, then opens the composer)
 * - X: x.com/intent/post with the link inside `text` (separate `url` is dropped on redirect)
 * - Facebook only accepts the link; it builds its own preview from the page.
 */
export type SocialTarget = "kingschat" | "whatsapp" | "facebook" | "x" | "telegram" | "email";

const enc = encodeURIComponent;

export const socialShareUrl = (target: SocialTarget, link: string, text: string, subject = "Loveworld Music+"): string => {
  const withLink = `${text}\n${link}`;
  switch (target) {
    case "kingschat": return `https://kingschat.online/share?text=${enc(withLink)}`;
    case "whatsapp": return `https://wa.me/?text=${enc(withLink)}`;
    case "facebook": return `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`;
    case "x": return `https://x.com/intent/post?text=${enc(withLink)}`;
    case "telegram": return `https://t.me/share/url?url=${enc(link)}&text=${enc(text)}`;
    case "email": return `mailto:?subject=${enc(subject)}&body=${enc(`${text}\n\n${link}`)}`;
  }
};
