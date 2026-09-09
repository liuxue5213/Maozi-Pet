/**
 * 帽子AI宠物 - 宠物主动回忆
 * 对标"芙崽每日思考"/QQ宠物养成记忆：今天第一次对话时，宠物主动提及记得的事，
 * 让用户"看见"记忆 → 产生情感依赖（记忆本身即差异化信任特性）
 * 纯函数，无 IO，可单测
 */

/**
 * 本地今天零点（UTC ISO 刻度）
 * created_at 存的是 UTC ISO，直接和本地日期字符串比较会跨时区错位
 * （如本地 09-10 凌晨 2 点 = UTC 09-09 18 点，会被误判成昨天）
 */
export function localDayStartISO(now = new Date()): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

/** 消息是否产生于本地今天（与 created_at 同刻度比较） */
export function isMessageFromToday(createdAt: string | undefined, now = new Date()): boolean {
  if (!createdAt) return false;
  return createdAt >= localDayStartISO(now);
}

/** 从记忆列表中挑一条用于主动提及（优先最近的，最多看前 5 条） */
export function pickRecallMemory(memories: string[]): string | null {
  if (!Array.isArray(memories) || memories.length === 0) return null;
  const pool = memories.slice(0, 5);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 主动回忆的 prompt 指令（追加在 system prompt 末尾）
 * 无记忆时返回 null，调用方跳过注入
 */
export function buildRecallInstruction(petName: string, memories: string[]): string | null {
  const memory = pickRecallMemory(memories);
  if (!memory) return null;

  return [
    '',
    '【今日重逢】',
    `这是你今天第一次和主人说话。作为${petName}，自然地打个招呼，`,
    `并且顺势提起你记得的这件事：「${memory}」（用关心或好奇的口吻跟进一句，比如问问进展、`,
    `或者表达你一直记着）。只提这一件事，一两句话内完成，不要罗列、不要生硬复述。`,
  ].join('\n');
}

/**
 * AI 不可用时的本地兜底回忆问候：性格化问候 + 嵌入一条记忆
 */
export function buildLocalRecallReply(personality: string, petName: string, memories: string[]): string {
  const memory = pickRecallMemory(memories);
  if (!memory) return '';

  const greetings: Record<string, string[]> = {
    cute: [`喵~ 你来啦！${petName}一直记着呢——${memory}，后来怎么样了呀？`, `喵喵~ 想你了！对了对了，${memory}，${petName}可没忘哦~`],
    tsundere: [`哼，来了啊。才不是等你呢…那个，${memory}，我可还记着呢`, `哦，你来了。别以为我不知道——${memory}，哼`],
    funny: [`哇！主人上线啦！${petName}的小脑瓜里还存着呢：${memory}，哈哈哈后来呢后来呢？`, `报告主人！${petName}的记忆芯片有消息：${memory}！`],
    calm: [`你来了。${petName}今天也想起了一件事——${memory}，一直放在心上`, `嗯，你来了呢。还记得吗，${memory}，想听听后来怎么样`],
    cool: [`来了。${memory}——我还记得`, `嗯。有件事一直记着：${memory}。说吧，后来呢`],
  };

  const list = greetings[personality] || greetings.cute;
  return list[Math.floor(Math.random() * list.length)];
}
