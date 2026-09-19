# FIT / LOG

繁體中文飲食、訓練、步數及身體數據追蹤 App。介面使用英文 Gym 動作名稱，營養數據以固定顏色顯示。

## 已完成

- 食物相片上載、瀏覽器壓縮及 AI 分析
- 逐項確認食物、煮法、用油、份量與實際食用比例
- 熱量、Protein、Carbs、Fat 每日統計
- 60+ 個 Gym 動作，按肌群自動篩選
- 多肌群訓練、搜尋、自訂動作、Weight／Reps／Sets、沿用上次
- 每日步數及快速輸入
- 體重、體脂、骨骼肌量及目標設定
- 7／30／90 日趨勢
- 本機離線保存
- Google Sheets 備份及 AI 後端

## 檔案

- `index.html`：App 畫面
- `styles.css`：介面設計
- `entries.css`：紀錄列表及刪除按鈕
- `app.js`：前端功能及本機資料
- `exercises.js`：完整運動動作資料
- `config.js`：Gift-ready 後端連線設定
- `Code.gs`：Google Apps Script 後端
- `appsscript.json`：Apps Script 設定

## A. 部署 Google Sheets／Apps Script 後端

1. 建立一份新的 Google Sheet，例如命名為 `FIT LOG Database`。
2. 在 Sheet 選擇「擴充功能 → Apps Script」。
3. 將 `Code.gs` 全部內容貼入編輯器。
4. 在 Apps Script 專案設定開啟「顯示 appsscript.json」，再以本專案版本取代。
5. 在 Apps Script 的「專案設定 → 指令碼屬性」新增：
   - `GEMINI_API_KEY`：你自己的 Gemini API key
   - `GEMINI_MODEL`：可選；預設為 `gemini-2.5-flash`
6. 在編輯器上方選擇 `setupFitLog`，按「執行」並完成 Google 授權。
7. 執行紀錄會回傳一組 `APP_TOKEN`；請保存這組字串。程式亦會將它加入指令碼屬性。
8. 選擇「部署 → 新增部署作業 → 網頁應用程式」。
9. 設定：
   - 執行身分：我
   - 存取權：任何人
10. 完成後複製 `/exec` 結尾的 Web App URL。

`APP_TOKEN` 用於保護後端端點；Gemini API key 只存在 Apps Script，切勿放進 GitHub 前端檔案。

## B. 部署 GitHub Pages

1. 建立一個新的 GitHub repository。
2. 將以下四個前端檔案放在 repository 根目錄：
   - `index.html`
   - `styles.css`
   - `entries.css`
   - `app.js`
   - `exercises.js`
   - `config.js`
3. 前往 repository「Settings → Pages」。
4. Source 選擇 `Deploy from a branch`，Branch 選 `main` 及 `/root`。
5. 等候 GitHub 提供 Pages 網址。

## C. 首次使用

1. 開啟 GitHub Pages 網址。
2. App 會自動開啟個人資料設定。
3. 填寫基本資料及每日目標。
4. 在底部兩格填入：
   - Apps Script Web App URL
   - `APP_TOKEN`
5. 儲存。

之後每次修改資料，App 都會先即時保存到目前裝置，再嘗試備份到 Google Sheets。即使暫時離線，亦可以繼續使用。

## AI 準確度

相片分析只能估算份量、煮食油及醬汁。所有 AI 結果都會先進入確認畫面，用家可修改每項食物、煮法、份量、用油及營養數字，確認後才加入每日紀錄。

## 私隱

- 原相在瀏覽器壓縮後傳送至 AI 分析，App 不會將相片寫入 Google Sheets。
- Google Sheets 只保存文字紀錄及營養數據。
- 瀏覽器會保存一份本機資料。
- 如使用共用裝置，可在「個人」頁清除本機資料。

## 更新 Apps Script

修改 `Code.gs` 後，需要在「管理部署作業」建立新版本並重新部署；一般情況可沿用同一條 Web App URL。
