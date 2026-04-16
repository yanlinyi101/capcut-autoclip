import datetime
import jieba.posseg as pseg
import pysrt

STOP_WORDS = {
    "今天", "其实", "那个", "就是", "知道", "觉得", "可能", "应该", "因为", "所以",
    "这个", "那个", "一下", "一点", "一些", "什么", "怎么", "哪里", "这时候", "那时候",
    "咱们", "我们", "你们", "他们", "自己", "东西", "事情", "感觉", "样子", "这种",
    "那种", "里面", "外面", "上面", "下面", "前面", "后面", "左边", "右边", "中间",
    "开始", "结束", "继续", "出现", "出来", "进去", "过来", "过去", "起来", "下来",
    "地方", "被称作", "传说", "时候", "一趟", "故事", "智慧", "门道", "心意", "样子",
    "大街", "小巷", "细节", "意思", "名字", "说法", "部分", "情况", "问题", "原因",
    "结果", "目的", "方法", "方式", "手段", "工具", "条件", "环境", "背景", "基础",
    "特点", "特征", "性质", "状态", "过程", "阶段", "程度", "水平", "标准", "原则",
    "规矩", "习惯", "传统", "文化", "历史", "社会", "国家", "民族", "世界", "人类",
    "生活", "工作", "学习", "教育", "艺术", "科学", "技术", "经济", "政治", "军事",
    "法律", "道德", "宗教", "哲学", "文学", "语言", "文字", "符号", "图像", "声音",
    "颜色", "味道", "气味", "触觉", "感觉", "知觉", "记忆", "思维", "想象", "情感",
    "意志", "性格", "气质", "能力", "才干", "本事", "本领", "技能", "技巧", "经验",
    "教训", "道理", "真理", "知识", "学问", "理论", "学说", "观点", "看法", "见解",
    "主张", "建议", "意见", "方案", "计划", "规划", "设计", "安排", "部署", "措施",
    "办法", "步骤", "环节", "方面", "领域", "范畴", "层次", "角度", "视野", "眼光",
    "胸怀", "气度", "风格", "风度", "风采", "风貌", "景象", "景色", "景致", "风光",
    "风景", "景观", "景象", "气象", "气氛", "氛围", "情调", "情趣", "情致", "情怀",
    "情操", "情谊", "情义", "情分", "情面", "情理", "情由", "情形", "形势", "形态",
    "形状", "形象", "形式", "样式", "模式", "模型", "范式", "样板", "榜样", "典型",
    "代表", "象征", "标志", "记号", "符号", "暗号", "信号", "口号", "标语", "警句",
    "格言", "谚语", "俗语", "成语", "典故", "寓言", "神话", "童话", "笑话", "谜语",
}

ALLOWED_FLAGS = {"ns", "nr", "n", "nz"}


def ms_to_timestamp(ms: int) -> str:
    seconds = int(ms / 1000)
    return str(datetime.timedelta(seconds=seconds))


def extract_keywords(text: str) -> list[str]:
    words = pseg.cut(text)
    keywords = []
    for word, flag in words:
        if len(word) < 2:
            continue
        if word in STOP_WORDS:
            continue
        if flag in ALLOWED_FLAGS:
            keywords.append(f"{word}({flag})")
    return keywords


def extract_from_srt(srt_file: str) -> list[dict]:
    """Parse SRT subtitle file and extract keywords with timestamps."""
    subs = pysrt.open(srt_file, encoding="utf-8")
    timeline_data = []
    idx = 0

    for sub in subs:
        text = sub.text.strip().replace("\n", " ")
        if not text:
            continue

        kws = extract_keywords(text)
        if kws:
            start = str(sub.start).split(",")[0]  # HH:MM:SS
            end = str(sub.end).split(",")[0]
            timeline_data.append(
                {
                    "index": idx,
                    "start_time": start,
                    "end_time": end,
                    "text": text,
                    "keywords": kws,
                }
            )
            idx += 1

    return timeline_data
