import { DailyResult, Period, UserStats } from "../types/types";
import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  collectionGroup,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

const VOICE_COIN_INTERVAL = 8 * 60 * 1000;
const VOICE_COIN_AMOUNT = 1;

function emptyUserStats(): UserStats {
  return {
    xp: 0,
    level: 0,
    messages: 0,
    voiceMinutes: 0,
    balance: 0,
    rep: 0,
    lotus: 0,
  };
}

export function getXpForLevel(level: number): number {
  if (level <= 0) return 0;
  const a = 12;
  const b = 1.08;
  return Math.floor(a * Math.pow(level, 2) * Math.pow(b, level / 100));
}

export function getLevelFromXp(xp: number): number {
  let level = 0;
  while (getXpForLevel(level + 1) <= xp) level++;
  return level;
}

function getKyivDateComponents() {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  };
  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "0";
  const month = (parts.find((p) => p.type === "month")?.value ?? "1").padStart(
    2,
    "0",
  );
  const day = (parts.find((p) => p.type === "day")?.value ?? "1").padStart(
    2,
    "0",
  );

  return { year: parseInt(year), month: parseInt(month), day: parseInt(day) };
}
function getCurrentKyivDateISO() {
  const { year, month, day } = getKyivDateComponents();
  return `${year}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function getCurrentKyivWeek() {
  const { year, day, month } = getKyivDateComponents();
  const date = new Date(year, month - 1, day);
  const firstDayOfYear = new Date(year, 0, 1);
  const days = Math.floor(
    (date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000),
  );
  const weekNumber = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${weekNumber.toString().padStart(2, "0")}`;
}

function getCurrentKyivMonth() {
  const { year, month } = getKyivDateComponents();
  return `${year}-${month.toString().padStart(2, "0")}`;
}

function getCurrentKyivYear() {
  const { year } = getKyivDateComponents();
  return `${year}`;
}

async function ensureUserStats(guildId: string, userId: string) {
  const userRef = doc(db, "guilds", guildId, "users", userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      all: emptyUserStats(),
      day: emptyUserStats(),
      week: emptyUserStats(),
      month: emptyUserStats(),
      year: emptyUserStats(),

      marriedTo: null,
      lastDaily: 0,
      lastVoiceReward: 0,
      lastVoiceCoin: 0,
    });
  } else {
    const data = snap.data();
    const updated: any = {};
    let need = false;

    for (const p of ["all", "day", "week", "month", "year"] as Period[]) {
      if (data[p]) {
        let periodUpdated = false;
        const periodData = { ...data[p] };

        if (periodData.balance === undefined) {
          periodData.balance = 0;
          periodUpdated = true;
        }
        if (periodData.rep === undefined) {
          periodData.rep = 0;
          periodUpdated = true;
        }

        if (p === "all" && periodData.lotus === undefined) {
          periodData.lotus = 0;
          periodUpdated = true;
        }

        if (periodUpdated) {
          updated[p] = periodData;
          need = true;
        }
      }
    }

    for (const field of ["lastDaily", "lastVoiceReward", "lastVoiceCoin"]) {
      if (!(field in data)) {
        updated[field] = 0;
        need = true;
      }
    }

    if (!("marriedTo" in data)) {
      updated.marriedTo = null;
      need = true;
    }

    if (need) {
      await setDoc(userRef, updated, { merge: true });
    }
  }

  return userRef;
}

export async function addXp(
  guildId: string,
  userId: string,
  messageContent?: string,
): Promise<UserStats> {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data() as Record<Period, UserStats>;

  let xpGain = 1;
  if (messageContent && messageContent.length >= 6) xpGain = 6;

  (["all", "day", "week", "month", "year"] as Period[]).forEach((period) => {
    const stats = data[period];
    stats.xp += xpGain;
    stats.messages += 1;
    const newLevel = getLevelFromXp(stats.xp);
    if (newLevel > stats.level) stats.level = newLevel;
  });

  await setDoc(userRef, data);
  return data["all"];
}

export async function addVoiceXp(
  guildId: string,
  userId: string,
  minutes: number,
): Promise<UserStats> {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data() as Record<Period, UserStats>;

  const xpGain = minutes * 2;

  (["all", "day", "week", "month", "year"] as Period[]).forEach((period) => {
    const stats = data[period];
    stats.voiceMinutes += minutes;
    stats.xp += xpGain;
    const newLevel = getLevelFromXp(stats.xp);
    if (newLevel > stats.level) stats.level = newLevel;
  });

  await setDoc(userRef, data);
  return data["all"];
}

export function formatVoiceTime(minutes: number): string {
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  return `${String(days).padStart(2, "0")}:${String(hours).padStart(
    2,
    "0",
  )}:${String(mins).padStart(2, "0")}`;
}

export async function getUserStats(
  guildId: string,
  userId: string,
  period: Period = "all",
): Promise<UserStats> {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data() as Record<Period, UserStats>;
  return data[period];
}

export async function getLeaderboard(guildId: string, period: Period = "all") {
  const usersCol = collection(db, "guilds", guildId, "users");
  const snapshot = await getDocs(usersCol);
  const leaderboard: { userId: string; stats: UserStats }[] = [];

  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as Record<Period, UserStats>;
    leaderboard.push({ userId: docSnap.id, stats: data[period] });
  });

  return leaderboard.sort((a, b) => b.stats.xp - a.stats.xp);
}

export async function resetOldPeriods() {
  const metaRef = doc(db, "meta", "resets");
  const metaSnap = await getDoc(metaRef);
  const lastReset = metaSnap.exists() ? metaSnap.data() : {};

  const today = getCurrentKyivDateISO();
  const currentWeek = getCurrentKyivWeek();
  const currentMonth = getCurrentKyivMonth();
  const currentYear = getCurrentKyivYear();

  const needReset = {
    day: lastReset.day !== today,
    week: lastReset.week !== currentWeek,
    month: lastReset.month !== currentMonth,
    year: lastReset.year !== currentYear,
  };

  console.log("🔍 needReset:", needReset);
  if (!Object.values(needReset).some(Boolean)) {
    console.log("ℹ️ Скидання не потрібно — усі періоди актуальні.");
    return;
  }

  console.log("♻️ Починаємо скидання статистики (через collectionGroup)...");

  const usersSnap = await getDocs(collectionGroup(db, "users"));
  console.log(`📂 Знайдено користувачів: ${usersSnap.size}`);

  let updatedCount = 0;
  let resetCounters = { day: 0, week: 0, month: 0, year: 0 };

  for (const userDoc of usersSnap.docs) {
    const pathParts = userDoc.ref.path.split("/");
    const guildId = pathParts[1];
    const userId = pathParts[3];

    const userData = userDoc.data() as Record<Period, UserStats>;
    const globalLevel = userData.all?.level ?? 0;

    const newData: Record<Period, UserStats> = { ...userData };

    if (needReset.day) {
      newData.day = { ...emptyUserStats(), level: globalLevel };
      resetCounters.day++;
    }
    if (needReset.week) {
      newData.week = { ...emptyUserStats(), level: globalLevel };
      resetCounters.week++;
    }
    if (needReset.month) {
      newData.month = { ...emptyUserStats(), level: globalLevel };
      resetCounters.month++;
    }
    if (needReset.year) {
      newData.year = { ...emptyUserStats(), level: globalLevel };
      resetCounters.year++;
    }

    await setDoc(userDoc.ref, newData, { merge: true });
    updatedCount++;

    console.log(`✅ Скинуто користувача ${userId} (${guildId})`);
  }

  await setDoc(
    metaRef,
    { day: today, week: currentWeek, month: currentMonth, year: currentYear },
    { merge: true },
  );

  console.log(
    `🎉 Скидання завершено успішно! Оновлено ${updatedCount} користувачів.\n` +
      `📊 Деталі: ${resetCounters.day} днів, ${resetCounters.week} тижнів, ${resetCounters.month} місяців, ${resetCounters.year} років.`,
  );
}

export async function forceResetPeriod(
  guildId: string,
  period: Exclude<Period, "all">,
) {
  const usersCol = collection(db, "guilds", guildId, "users");
  const usersSnap = await getDocs(usersCol);

  for (const userDoc of usersSnap.docs) {
    const userData = userDoc.data() as Record<Period, UserStats>;
    const globalLevel = userData.all.level;
    userData[period] = { ...emptyUserStats(), level: globalLevel };
    await setDoc(userDoc.ref, userData);
  }
}

export function getNextResetTimes() {
  const now = new Date();

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Europe/Kyiv",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "long",
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat("en-US", options);
  const parts = formatter.formatToParts(now);
  const map = new Map(parts.map((p) => [p.type, p.value]));

  const year = parseInt(map.get("year") ?? "0");
  const month = parseInt(map.get("month") ?? "1");
  const day = parseInt(map.get("day") ?? "1");
  const hour = parseInt(map.get("hour") ?? "0");
  const minute = parseInt(map.get("minute") ?? "0");
  const second = parseInt(map.get("second") ?? "0");
  const weekdayStr = map.get("weekday") ?? "Sunday";
  const weekdayMap: Record<string, number> = {
    Sunday: 0,
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
  };
  const weekday = weekdayMap[weekdayStr];

  let secondsToNextDay = 24 * 3600 - (hour * 3600 + minute * 60 + second);

  const nextDay = new Date(now.getTime() + secondsToNextDay * 1000);

  let daysToNextWeek = (8 - weekday) % 7;
  if (daysToNextWeek === 0) daysToNextWeek = 7;
  const secondsToNextWeek = secondsToNextDay + (daysToNextWeek - 1) * 24 * 3600;
  const nextWeekDate = new Date(now.getTime() + secondsToNextWeek * 1000);

  const isLeap = (y: number) => y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysToNextMonth = daysInMonth - day + 1;
  const secondsToNextMonth =
    secondsToNextDay + (daysToNextMonth - 1) * 24 * 3600;
  const nextMonthDate = new Date(now.getTime() + secondsToNextMonth * 1000);

  let daysToNextYear = daysInMonth - day + 1;
  const monthDays = [
    31,
    isLeap(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (let m = month; m < 12; m++) {
    daysToNextYear += monthDays[m];
  }
  const secondsToNextYear = secondsToNextDay + (daysToNextYear - 1) * 24 * 3600;
  const nextYearDate = new Date(now.getTime() + secondsToNextYear * 1000);

  return {
    day: nextDay,
    week: nextWeekDate,
    month: nextMonthDate,
    year: nextYearDate,
  };
}

export async function getMarriage(
  guildId: string,
  userId: string,
): Promise<string | null> {
  const userRef = doc(db, "guilds", guildId, "marriages", userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data().spouseId || null;
}

export async function setMarriage(
  guildId: string,
  userId: string,
  spouseId: string,
) {
  const userRef = doc(db, "guilds", guildId, "marriages", userId);
  const spouseRef = doc(db, "guilds", guildId, "marriages", spouseId);

  await setDoc(userRef, { spouseId });
  await setDoc(spouseRef, { spouseId: userId });
}

export async function divorceMarriage(
  guildId: string,
  userId: string,
  spouseId: string,
) {
  const userRef = doc(db, "guilds", guildId, "marriages", userId);
  const spouseRef = doc(db, "guilds", guildId, "marriages", spouseId);

  await setDoc(userRef, { spouseId: "" });
  await setDoc(spouseRef, { spouseId: "" });
}

export async function claimDaily(
  guildId: string,
  userId: string,
): Promise<DailyResult> {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data()!;

  const REQUIRED_VOICE = 180;
  const REQUIRED_MESSAGES = 100;
  const REWARD = 30;
  const COOLDOWN = 12 * 60 * 60 * 1000; // 12 часов

  const now = Date.now();
  const lastClaim = data.lastDaily ?? 0;

  // 🔒 Проверка кулдауна
  if (now - lastClaim < COOLDOWN) {
    const remaining = COOLDOWN - (now - lastClaim);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return {
      success: false,
      reason: "COOLDOWN",
      remaining: { hours, minutes, seconds },
    };
  }

  const statsDay = data.day;
  const voiceMinutes = statsDay.voiceMinutes ?? 0;
  const messages = statsDay.messages ?? 0;

  // 📊 Проверка активности
  if (voiceMinutes < REQUIRED_VOICE || messages < REQUIRED_MESSAGES) {
    return {
      success: false,
      reason: "NOT_ENOUGH_ACTIVITY",
      voiceMinutes,
      messages,
      requiredVoice: REQUIRED_VOICE,
      requiredMessages: REQUIRED_MESSAGES,
    };
  }

  const newBalance = (data.all.balance ?? 0) + REWARD;

  await updateDoc(userRef, {
    "all.balance": newBalance,
    lastDaily: now,
  });

  return {
    success: true,
    reward: REWARD,
    newBalance,
  };
}

export async function deductBalance(
  guildId: string,
  userId: string,
  amount: number,
) {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data();

  if (!data?.all?.balance) throw new Error("Баланс не знайдено");

  const newBalance = data.all.balance - amount;
  if (newBalance < 0) throw new Error("Недостатньо монет");

  await setDoc(
    userRef,
    { all: { ...data.all, balance: newBalance } },
    { merge: true },
  );
  return newBalance;
}

export async function giveRep(
  guildId: string,
  giverId: string,
  receiverId: string,
  amount: number,
): Promise<{
  success: boolean;
  message: string;
  newRep?: number;
  ephemeral?: boolean;
}> {
  if (giverId === receiverId)
    return { success: false, message: "Нельзя давати реп самому собі" };

  const receiverRef = await ensureUserStats(guildId, receiverId);
  const receiverSnap = await getDoc(receiverRef);
  const data = receiverSnap.data();

  if (!data) return { success: false, message: "Користувач не знайдений" };

  // Створюємо day.repGiven якщо його немає
  if (!data.day.repGiven) data.day.repGiven = {};

  const lastGiven = data.day.repGiven[giverId] ?? 0;
  const now = Date.now();

  // 24 години
  const cooldown = 5 * 1000;

  if (now - lastGiven < cooldown) {
    const remaining = cooldown - (now - lastGiven);
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    return {
      success: false,
      message: `Ви вже давали реп цьому користувачу. Зачекайте ${hours}г ${minutes}хв ${seconds}с.`,
      ephemeral: true,
    };
  }

  // Оновлюємо репутацію у ALL
  const newAll = {
    ...data.all,
    rep: (data.all.rep ?? 0) + amount,
  };

  // Проставляємо новий timestamp в денну статистику
  const newDay = {
    ...data.day,
    repGiven: {
      ...data.day.repGiven,
      [giverId]: now,
    },
  };

  await updateDoc(receiverRef, {
    all: newAll,
    day: newDay,
  });

  return {
    success: true,
    message: `Реп змінено на ${amount > 0 ? "+" : ""}${amount}`,
    newRep: newAll.rep,
  };
}

export const REQUIRED_MINUTES = 300;
export const REWARD_AMOUNT = 150;
export const REWARD_COOLDOWN = 12 * 60 * 60 * 1000;

type RewardResult =
  | {
      success: true;
      reward: number;
      newBalance: number;
    }
  | {
      success: false;
      reason: "NOT_ENOUGH_MINUTES";
      minutes: number;
      required: number;
      remaining: number;
    }
  | {
      success: false;
      reason: "COOLDOWN";
      remainingMs: number;
    };

export async function claimVoiceReward(
  guildId: string,
  userId: string,
): Promise<RewardResult> {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data()!;

  const statsDay = data.day;
  const minutes = statsDay.voiceMinutes ?? 0;

  if (minutes < REQUIRED_MINUTES) {
    return {
      success: false,
      reason: "NOT_ENOUGH_MINUTES",
      minutes,
      required: REQUIRED_MINUTES,
      remaining: REQUIRED_MINUTES - minutes,
    };
  }

  const lastReward = data.lastVoiceReward ?? 0;
  const now = Date.now();

  if (now - lastReward < REWARD_COOLDOWN) {
    return {
      success: false,
      reason: "COOLDOWN",
      remainingMs: REWARD_COOLDOWN - (now - lastReward),
    };
  }

  const newDayBalance = (statsDay.balance ?? 0) + REWARD_AMOUNT;
  const newAllBalance = (data.all.balance ?? 0) + REWARD_AMOUNT;

  await updateDoc(userRef, {
    day: { ...statsDay, balance: newDayBalance },
    all: { ...data.all, balance: newAllBalance },
    lastVoiceReward: now,
  });

  return {
    success: true,
    reward: REWARD_AMOUNT,
    newBalance: newAllBalance,
  };
}

export async function getUserClan(
  guildId: string,
  userId: string,
): Promise<string | null> {
  const clansRef = collection(db, "guilds", guildId, "clans");
  const clansSnap = await getDocs(clansRef);

  for (const clanDoc of clansSnap.docs) {
    const data = clanDoc.data();
    if (data.members?.includes(userId)) {
      return clanDoc.id;
    }
  }

  return null;
}

// ===========================
// 📌 Створити клан
// ===========================
export async function createClan(
  guildId: string,
  clanId: string,
  ownerId: string,
  name: string,
) {
  const clanRef = doc(db, "guilds", guildId, "clans", clanId);

  const snap = await getDoc(clanRef);
  if (snap.exists()) {
    throw new Error("Клан з таким ID вже існує.");
  }

  await setDoc(clanRef, {
    name,
    owner: ownerId,
    members: [ownerId],
    joinRequests: [],
  });

  return { success: true, message: "Клан створено!" };
}

// ===========================
// 📌 Подати заявку на вступ
// ===========================
export async function requestJoinClan(
  guildId: string,
  clanId: string,
  userId: string,
) {
  const clanRef = doc(db, "guilds", guildId, "clans", clanId);
  const snap = await getDoc(clanRef);

  if (!snap.exists()) throw new Error("Клан не знайдений");

  const data = snap.data();

  if (data.members.includes(userId)) {
    return { success: false, message: "Ви вже в цьому клані" };
  }

  if (data.joinRequests.includes(userId)) {
    return { success: false, message: "Ви вже подали заявку" };
  }

  await updateDoc(clanRef, {
    joinRequests: [...data.joinRequests, userId],
  });

  return { success: true, message: "Заявка відправлена!" };
}

// ===========================
// 📌 Прийняти учасника в клан
// ===========================
export async function acceptToClan(
  guildId: string,
  clanId: string,
  ownerId: string,
  userId: string,
) {
  const clanRef = doc(db, "guilds", guildId, "clans", clanId);
  const snap = await getDoc(clanRef);

  if (!snap.exists()) throw new Error("Клан не знайдений");

  const data = snap.data();

  if (data.owner !== ownerId) {
    return {
      success: false,
      message: "Тільки лідер клану може приймати учасників",
    };
  }

  if (!data.joinRequests.includes(userId)) {
    return { success: false, message: "Користувач не подавав заявку" };
  }

  await updateDoc(clanRef, {
    members: [...data.members, userId],
    joinRequests: data.joinRequests.filter((id: string) => id !== userId),
  });

  return { success: true, message: "Учасника прийнято!" };
}

// ===========================
// 📌 Покинути клан
// ===========================
export async function leaveClan(
  guildId: string,
  clanId: string,
  userId: string,
) {
  const clanRef = doc(db, "guilds", guildId, "clans", clanId);
  const snap = await getDoc(clanRef);

  if (!snap.exists()) throw new Error("Клан не знайдений");

  const data = snap.data();

  if (!data.members.includes(userId)) {
    return { success: false, message: "Ви не в цьому клані" };
  }

  // Якщо власник — то клан видаляється
  if (data.owner === userId) {
    await deleteDoc(clanRef);
    return { success: true, message: "Ви були лідером. Клан видалено." };
  }

  await updateDoc(clanRef, {
    members: data.members.filter((id: string) => id !== userId),
  });

  return { success: true, message: "Ви покинули клан" };
}

// ===========================
// 📌 Видалити клан (лише власник)
// ===========================
export async function deleteClan(
  guildId: string,
  clanId: string,
  ownerId: string,
) {
  const clanRef = doc(db, "guilds", guildId, "clans", clanId);
  const snap = await getDoc(clanRef);

  if (!snap.exists()) throw new Error("Клан не знайдений");

  const data = snap.data();

  if (data.owner !== ownerId) {
    return { success: false, message: "Лише власник може видалити клан" };
  }

  await deleteDoc(clanRef);

  return { success: true, message: "Клан видалено" };
}

export async function ownerKickMember(
  guildId: string,
  clanId: string,
  ownerId: string,
  targetId: string,
) {
  const clanRef = doc(db, `guilds/${guildId}/clans/${clanId}`);
  const snapshot = await getDoc(clanRef);

  if (!snapshot.exists()) {
    return { success: false, message: "Клан не знайдено." };
  }

  const clan = snapshot.data();

  if (clan.owner !== ownerId) {
    return {
      success: false,
      message: "Тільки власник клану може виганяти учасників.",
    };
  }

  if (!clan.members || !Array.isArray(clan.members)) {
    return { success: false, message: "Список учасників пошкоджено." };
  }

  if (!clan.members.includes(targetId)) {
    return { success: false, message: "Користувач не є учасником клану." };
  }

  const updatedMembers = clan.members.filter((id: string) => id !== targetId);

  await updateDoc(clanRef, { members: updatedMembers });

  return {
    success: true,
    message: `Користувача <@${targetId}> вигнано з клану.`,
  };
}

export async function ownerCancelRequest(
  guildId: string,
  clanId: string,
  ownerId: string,
  targetId: string,
) {
  const clanRef = doc(db, `guilds/${guildId}/clans/${clanId}`);
  const snapshot = await getDoc(clanRef);

  if (!snapshot.exists()) {
    return { success: false, message: "Клан не знайдено." };
  }

  const clan = snapshot.data();

  if (clan.owner !== ownerId) {
    return {
      success: false,
      message: "Тільки власник клану може скасовувати заявки.",
    };
  }

  if (
    !Array.isArray(clan.joinRequests) ||
    !clan.joinRequests.includes(targetId)
  ) {
    return { success: false, message: "У цього користувача немає заявки." };
  }

  const updatedRequests = clan.joinRequests.filter(
    (id: string) => id !== targetId,
  );

  await updateDoc(clanRef, { joinRequests: updatedRequests });

  return {
    success: true,
    message: `Заявку користувача <@${targetId}> скасовано.`,
  };
}

export async function giveVoicePassiveCoin(guildId: string, userId: string) {
  const ref = await ensureUserStats(guildId, userId);
  const snap = await getDoc(ref);
  const data = snap.data();

  if (!data) return;

  const now = Date.now();
  const last = data.lastVoiceCoin ?? 0;

  if (now - last < VOICE_COIN_INTERVAL) return;

  const newBalance = (data.all.balance ?? 0) + VOICE_COIN_AMOUNT;

  await updateDoc(ref, {
    all: { ...data.all, balance: newBalance },
    lastVoiceCoin: now,
  });

  return newBalance;
}

export async function spendBalance(
  guildId: string,
  userId: string,
  amount: number,
) {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const ref = doc(db, "guilds", guildId, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("USER_STATS_NOT_FOUND");
  }

  const data = snap.data();

  const currentBalance = data.all?.balance ?? 0;

  if (currentBalance < amount) {
    throw new Error("NOT_ENOUGH_BALANCE");
  }

  const newBalance = currentBalance - amount;

  await updateDoc(ref, {
    "all.balance": newBalance,
  });

  return newBalance;
}

export async function addBalance(
  guildId: string,
  userId: string,
  amount: number,
) {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const ref = doc(db, "guilds", guildId, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("USER_STATS_NOT_FOUND");
  }

  const data = snap.data();
  const currentBalance = data.all?.balance ?? 0;
  const newBalance = currentBalance + amount;

  await updateDoc(ref, {
    "all.balance": newBalance,
  });

  return newBalance;
}

export const LOTUS_EXCHANGE_RATE = 150; // 150 монет = 1 лотус

export async function exchangeCoinsToLotus(
  guildId: string,
  userId: string,
  amount: number = 1,
) {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  const data = snap.data();

  const coinsNeeded = LOTUS_EXCHANGE_RATE * amount;
  const currentBalance = data.all?.balance ?? 0;
  const currentLotus = data.all?.lotus ?? 0;

  if (currentBalance < coinsNeeded) {
    throw new Error("NOT_ENOUGH_COINS");
  }

  const newBalance = currentBalance - coinsNeeded;
  const newLotus = currentLotus + amount;

  await updateDoc(userRef, {
    "all.balance": newBalance,
    "all.lotus": newLotus,
  });

  return {
    spent: coinsNeeded,
    received: amount,
    balance: newBalance,
    lotus: newLotus,
  };
}

export async function exchangeLotusToCoins(
  guildId: string,
  userId: string,
  amount: number = 1,
) {
  if (amount <= 0) {
    throw new Error("INVALID_AMOUNT");
  }

  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("USER_NOT_FOUND");
  }

  const data = snap.data();

  const currentLotus = data.all?.lotus ?? 0;
  const currentBalance = data.all?.balance ?? 0;

  if (currentLotus < amount) {
    throw new Error("NOT_ENOUGH_LOTUS");
  }

  const coinsReceived = LOTUS_EXCHANGE_RATE * amount;

  const newLotus = currentLotus - amount;
  const newBalance = currentBalance + coinsReceived;

  await updateDoc(userRef, {
    "all.lotus": newLotus,
    "all.balance": newBalance,
  });

  return {
    spentLotus: amount,
    receivedCoins: coinsReceived,
    balance: newBalance,
    lotus: newLotus,
  };
}

export async function deductLotus(
  guildId: string,
  userId: string,
  amount: number,
) {
  const userRef = await ensureUserStats(guildId, userId);
  const snap = await getDoc(userRef);
  const data = snap.data();

  const currentLotus = data?.all?.lotus ?? 0;
  if (currentLotus < amount) throw new Error("Недостатньо лотусів");

  const newLotus = currentLotus - amount;

  await updateDoc(userRef, {
    "all.lotus": newLotus,
  });

  return newLotus;
}
