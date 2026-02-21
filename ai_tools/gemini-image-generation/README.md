# Gemini Image Generation

Google Gemini API를 사용한 이미지 생성 예제입니다.

## 사용 가능한 모델

- **gemini-2.5-flash-image**: 빠른 처리 속도, 1024px 해상도
- **gemini-3-pro-image-preview**: 전문적 품질, 4K 해상도 지원

## 사용법

```bash
# 기본 사용 (gemini-2.5-flash-image 모델)
python generate_image.py --prompt "A luxury lip tint product from APR brand"

# 다른 모델 사용
python generate_image.py --prompt "Create a minimalist logo" --model gemini-3-pro-image-preview

# 출력 파일명 지정
python generate_image.py --prompt "Modern office space" --output office.png
```

## 옵션

- `--prompt`: (필수) 이미지 생성 프롬프트
- `--model`: 사용할 모델 (기본값: gemini-2.5-flash-image)
- `--output`: 출력 파일명 (기본값: generated_image.png)

생성된 이미지는 `output/` 폴더에 저장됩니다.

## 참고 문서

더 자세한 정보는 [Gemini API 이미지 생성 문서](https://ai.google.dev/gemini-api/docs/image-generation?hl=en)를 참고하세요.
