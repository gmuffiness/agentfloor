# CLI npm 배포 가이드

## 자동 배포 (GitHub Actions)

`cli/` 디렉토리 내 파일이 변경되어 `main` 브랜치에 push되면 GitHub Actions가 자동으로 npm 배포를 시도합니다.

워크플로우: `.github/workflows/publish-cli.yml`

### 배포 조건 (두 가지 모두 충족해야 함)

1. **경로 필터**: `cli/` 하위 파일이 변경된 커밋이 `main`에 push됨
2. **버전 변경**: `cli/package.json`의 `version`이 npm에 이미 배포된 버전과 다름

### CLI 코드 변경 후 배포 절차

```bash
# 1. CLI 코드 수정 (cli/ 디렉토리 내 파일)

# 2. cli/package.json 버전 bump (semver 규칙 준수)
#    - patch (0.1.2 → 0.1.3): 버그 수정, 사소한 변경
#    - minor (0.1.3 → 0.2.0): 새 기능 추가, 하위 호환
#    - major (0.2.0 → 1.0.0): 브레이킹 변경

# 3. 커밋 & 푸시
git add cli/
git commit -m "feat: description of change"
git push
```

### 버전 bump를 깜빡했을 때

CLI 코드만 변경하고 버전을 안 올리면 GitHub Actions가 트리거되지만 "Skipped — version already published"로 skip됩니다.

이 경우:
```bash
# cli/package.json version bump 후 다시 push
git add cli/package.json
git commit -m "chore: bump CLI version to x.y.z"
git push
```

### 수동 트리거

GitHub Actions 페이지에서 `workflow_dispatch`로 수동 실행도 가능합니다.

```bash
gh workflow run publish-cli.yml
```

## Hub (Vercel) 배포

Hub 웹앱은 Vercel에 연결되어 있어 `main` push 시 자동 배포됩니다.

- CLI 전용 변경이더라도 `main` push 시 Vercel 재배포가 트리거됨
- Vercel 환경변수는 Vercel Dashboard → Settings → Environment Variables에서 관리
- 새 환경변수 추가 시 Vercel에도 반드시 설정 필요

## 현재 배포 상태 확인

```bash
# npm 배포 버전 확인
npm view agentfloor version

# GitHub Actions 최근 실행 확인
gh run list --limit 5

# 특정 run 로그 확인
gh run view <run-id> --log
```
