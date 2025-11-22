"""
AI文本生成服务
用于生成适合方言练习的日常对话句子
"""

import random
import requests
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

class AITextGenerator:
    def __init__(self, api_key: str = "", base_url: str = "https://api.siliconflow.cn/v1"):
        """
        初始化AI文本生成器

        Args:
            api_key: 硅基流动API密钥
            base_url: API基础URL
        """
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()

    def _call_siliconflow_api(self, prompt: str, max_tokens: int = 100, temperature: float = 1.2) -> Optional[str]:
        """
        调用硅基流动API生成文本

        Args:
            prompt: 提示词
            max_tokens: 最大token数
            temperature: 温度参数，控制随机性

        Returns:
            生成的文本，失败时返回None
        """
        if not self.api_key:
            logger.warning("SiliconFlow API key not configured")
            return None

        try:
            headers = {
                'Authorization': f'Bearer {self.api_key}',
                'Content-Type': 'application/json'
            }

            data = {
                "model": "Qwen/Qwen3-30B-A3B-Instruct-2507",
                "messages": [
                    {
                        "role": "system",
                        "content": "你是一个音频数据收集助手。请生成一些日常生活中常用的中文句子，可能是某个话题中的某句话、可能是某件事的回答、也可能是争论某个话题时的论点，尽可能真正全方面贴近生活中会说的话。句子长度控制在15-30字之间，内容要贴近生活，每次生成的句子之间都没关联。每次只返回一个句子，不要有多余的解释。"
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "max_tokens": max_tokens,
                "temperature": temperature
            }

            response = self.session.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=data,
                timeout=10
            )

            if response.status_code == 200:
                result = response.json()
                text = result['choices'][0]['message']['content'].strip()

                # 清理可能的多余字符
                text = text.strip().strip('"').strip('。').strip('！').strip('？')
                text += '。' if not text.endswith(('。', '！', '？')) else ''

                logger.info(f"Generated AI text: {text}")
                return text
            else:
                logger.error(f"SiliconFlow API error: {response.status_code} - {response.text}")
                return None

        except requests.exceptions.Timeout:
            logger.error("SiliconFlow API request timeout")
            return None
        except requests.exceptions.RequestException as e:
            logger.error(f"SiliconFlow API request error: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error calling SiliconFlow API: {e}")
            return None

    def _validate_text(self, text: str) -> str:
        """
        验证和清理生成的文本

        Args:
            text: 原始文本

        Returns:
            清理后的文本
        """
        if not text:
            return ""

        # 基础清理
        text = text.strip()

        # 移除可能的引号
        text = text.strip('"').strip("'").strip('"')

        # 确保以合适的标点符号结尾
        if not text.endswith(('。', '！', '？')):
            if text.endswith(('，', '；', '：')):
                text = text[:-1] + '。'
            else:
                text += '。'

        # 长度限制
        max_length = 100
        if len(text) > max_length:
            text = text[:max_length-3] + '...'

        return text

    def generate_text(self, use_api_first: bool = True) -> str:
        """
        生成AI文本

        Args:
            use_api_first: 是否优先使用API

        Returns:
            生成的文本，如果生成失败返回None
        """
        # 优先使用API
        if use_api_first:
            api_text = self._call_siliconflow_api("继续生成一个不重复的日常对话句子（15-30个字），方便用户跟读进行音频录制来作为数据集。")
            if api_text:
                validated_text = self._validate_text(api_text)
                if validated_text:
                    return validated_text

        # API失败时返回None
        logger.error("Failed to generate AI text")
        return None

    def generate_batch_texts(self, count: int = 10, use_api_first: bool = True) -> List[str]:
        """
        批量生成文本

        Args:
            count: 生成数量
            use_api_first: 是否优先使用API

        Returns:
            生成的文本列表
        """
        texts = []
        used_texts = set()

        for _ in range(count):
            text = self.generate_text(use_api_first)

            # 避免重复
            if text not in used_texts:
                texts.append(text)
                used_texts.add(text)

        # 如果生成的文本不够，补充预设文本
        preset_pool = [t for t in self.preset_texts if t not in used_texts]
        while len(texts) < count and preset_pool:
            text = random.choice(preset_pool)
            texts.append(text)
            preset_pool.remove(text)

        return texts[:count]

    
# 创建全局实例
def create_text_generator(api_key: str = "") -> AITextGenerator:
    """
    创建文本生成器实例

    Args:
        api_key: 硅基流动API密钥

    Returns:
        文本生成器实例
    """
    return AITextGenerator(api_key=api_key)