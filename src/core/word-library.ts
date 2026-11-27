// User-testing content only. These objects do not claim sign recognition support.
export const WORD_GROUPS = [
  { title: "Greetings/social", words: ["hello", "goodbye", "please", "thank you", "sorry", "yes", "no", "name", "nice", "meet"] },
  { title: "People/family", words: ["mother", "father", "brother", "sister", "baby", "family", "friend", "man", "woman", "child", "boy", "girl"] },
  { title: "Body/feelings", words: ["happy", "sad", "angry", "tired", "hungry", "thirsty", "hurt", "love", "feel", "understand"] },
  { title: "Everyday needs", words: ["toilet", "drink", "eat", "help", "want", "need", "more", "finish", "wait", "stop"] },
  { title: "Time", words: ["today", "tomorrow", "yesterday", "morning", "afternoon", "evening", "night", "week", "now", "later"] },
  { title: "Places", words: ["home", "school", "work", "shop", "hospital", "park", "town", "outside"] },
  { title: "Colours", words: ["red", "blue", "green", "yellow", "black", "white", "orange", "purple"] },
  { title: "Common verbs", words: ["go", "come", "see", "look", "know", "think", "make", "give", "take", "play", "learn", "teach"] },
  { title: "Questions/connectors", words: ["what", "where", "when", "who", "why", "how", "and", "but"] },
  { title: "Weather", words: ["rain", "sun", "snow", "wind", "cold", "hot"] },
  { title: "Food/drink", words: ["water", "tea", "coffee", "food", "milk", "bread"] },
  { title: "Misc common", words: ["good", "bad", "big", "small", "same", "different", "right", "wrong"] }
] as const;

export const WORD_PLACEHOLDERS = WORD_GROUPS.flatMap(group => group.words.map(word => ({
  id: `bsl-word-${word.replaceAll(" ", "-")}`,
  word,
  label: word[0].toUpperCase() + word.slice(1),
  category: "word" as const,
  group: group.title,
  available: false,
  reason: "Prototype placeholder: sign definition and diagram not yet added"
})));
