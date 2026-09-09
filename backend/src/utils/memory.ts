/**
 * 帽子AI宠物 - 记忆提取（纯函数，可单元测试）
 * 从用户消息中提取值得宠物记住的事实，规范化为记忆文本
 */

/** 与后端单条消息长度上限保持一致（routes/ai.ts MAX_MESSAGE_LENGTH） */
const MAX_MEMORY_TEXT_LENGTH = 500;

/**
 * 提取用户主动告知的事实，返回规范化记忆文本列表。
 * 支持：我叫X / 我喜欢X / 我讨厌X / 我生日X / 记住：X / 我在学(做)X
 */
export function extractFacts(text: string): string[] {
  const t = (text || '').trim().slice(0, MAX_MEMORY_TEXT_LENGTH);
  if (!t) return [];
  const facts: string[] = [];

  const name = /(?:我叫|我的名字(?:是|叫)|叫我)\s*([\u4e00-\u9fa5a-zA-Z0-9·]{1,12})/.exec(t);
  if (name) facts.push(`主人叫${name[1]}`);

  const like = /我喜欢\s*([\u4e00-\u9fa5a-zA-Z0-9]{1,12})/.exec(t);
  if (like) facts.push(`主人喜欢${like[1]}`);

  const hate = /我(?:讨厌|不喜欢|不爱)\s*([\u4e00-\u9fa5a-zA-Z0-9]{1,12})/.exec(t);
  if (hate) facts.push(`主人讨厌${hate[1]}`);

  const birthday = /我(?:的)?生日(?:是|在)?\s*([\d年月日]{4,12})/.exec(t);
  if (birthday) facts.push(`主人的生日是${birthday[1]}`);

  const todo = /记住[:：,，。\s]+(.{2,40})/.exec(t);
  if (todo) facts.push(`主人的叮嘱：${todo[1].trim()}`);

  const job = /我在(学习|研究|做|干)\s*([\u4e00-\u9fa5a-zA-Z0-9]{1,10})/.exec(t);
  if (job) facts.push(`主人在${job[1]}${job[2]}`);

  return facts;
}
