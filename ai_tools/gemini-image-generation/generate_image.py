"""
Gemini API를 사용한 이미지 생성 예제
"""

import os
import argparse
from pathlib import Path
from google import genai
from dotenv import load_dotenv

load_dotenv()

def generate_image(prompt, model="gemini-2.5-flash-image", output_name="generated_image.png", reference_image=None):
    """
    프롬프트를 입력받아 이미지 생성

    Args:
        prompt: 이미지 생성 프롬프트
        model: 사용할 Gemini 모델 (기본값: gemini-2.5-flash-image)
        output_name: 저장할 파일명
        reference_image: 참조할 이미지 파일 경로 (선택)
    """

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY가 .env 파일에 설정되지 않았습니다.")

    client = genai.Client(api_key=api_key)

    print(f"이미지 생성 중...")
    print(f"모델: {model}")
    print(f"프롬프트: {prompt[:100]}...")
    if reference_image:
        print(f"참조 이미지: {reference_image}")

    try:
        # 참조 이미지가 있으면 멀티모달 입력 구성
        if reference_image:
            from pathlib import Path
            ref_path = Path(reference_image)
            if not ref_path.exists():
                raise ValueError(f"참조 이미지를 찾을 수 없습니다: {reference_image}")

            with open(ref_path, "rb") as f:
                image_data = f.read()

            contents = [
                {
                    "role": "user",
                    "parts": [
                        {"inline_data": {"mime_type": "image/png", "data": image_data}},
                        {"text": prompt}
                    ]
                }
            ]
        else:
            contents = prompt

        response = client.models.generate_content(
            model=model,
            contents=contents,
            config={
                "response_modalities": ["IMAGE"]
            }
        )

        output_dir = Path("output")
        output_dir.mkdir(exist_ok=True)

        if response.candidates and len(response.candidates) > 0:
            candidate = response.candidates[0]
            if hasattr(candidate.content, 'parts') and len(candidate.content.parts) > 0:
                part = candidate.content.parts[0]

                if hasattr(part, 'inline_data'):
                    image_data = part.inline_data.data

                    output_path = output_dir / output_name
                    with open(output_path, "wb") as f:
                        f.write(image_data)

                    print(f"\n✓ 이미지가 생성되었습니다: {output_path}")
                    print(f"  파일 크기: {len(image_data) / 1024:.2f} KB")
                    return str(output_path)
                else:
                    print("오류: 이미지 데이터를 찾을 수 없습니다.")
            else:
                print("오류: 응답에 parts가 없습니다.")
        else:
            print("오류: 응답에 candidates가 없습니다.")

    except Exception as e:
        print(f"오류 발생: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    parser = argparse.ArgumentParser(
        description="Gemini API를 사용한 이미지 생성",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
사용 예제:
  python generate_image.py --prompt "A luxury lip tint product from APR brand"
  python generate_image.py --prompt "Create a minimalist logo" --model gemini-3-pro-image-preview
  python generate_image.py --prompt "Modern office space" --output office.png
        """
    )

    parser.add_argument(
        "--prompt",
        type=str,
        required=True,
        help="이미지 생성을 위한 프롬프트"
    )

    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.5-flash-image",
        choices=["gemini-2.5-flash-image", "gemini-3-pro-image-preview"],
        help="사용할 Gemini 모델 (기본값: gemini-2.5-flash-image)"
    )

    parser.add_argument(
        "--output",
        type=str,
        default="generated_image.png",
        help="출력 파일명 (기본값: generated_image.png)"
    )

    parser.add_argument(
        "--reference",
        type=str,
        help="참조할 이미지 파일 경로 (선택)"
    )

    args = parser.parse_args()

    print("=== Gemini Image Generation ===\n")
    generate_image(args.prompt, args.model, args.output, args.reference)

if __name__ == "__main__":
    main()
