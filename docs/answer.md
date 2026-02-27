# Chrome Web Store — 隱私權實務規範回覆

## 單一用途說明

Promoscope 是一款番茄鐘計時器，在每個工作時段自動追蹤使用者瀏覽了哪些網站，並在時段結束後以圓餅圖呈現時間分佈，幫助使用者了解自己的專注狀況。

## 權限理由

### alarms

本擴充功能使用 chrome.alarms API 實作番茄鐘倒數計時功能。由於 Manifest V3 的 Service Worker 可能隨時被瀏覽器終止，無法依賴 setInterval 或 setTimeout，因此需要 alarms 權限來確保計時器在背景持續運作。

### notifications

本擴充功能在番茄鐘工作時段或休息時段結束時，透過 chrome.notifications API 發送桌面通知提醒使用者，讓使用者即使不在瀏覽擴充功能彈出視窗時也能收到提醒。

### storage

本擴充功能使用 chrome.storage.local 儲存所有資料，包含計時器狀態、工作階段歷史紀錄、網站使用時間統計以及使用者設定。所有資料皆儲存在使用者的本機裝置上，不會傳送至任何外部伺服器。

### tabs

本擴充功能使用 chrome.tabs API（包含 tabs.onActivated 與 tabs.onUpdated 事件）來偵測使用者切換分頁或變更網址的行為，藉此在番茄鐘工作時段期間自動追蹤各網域的使用時間。僅記錄網域名稱（如 github.com），不記錄完整網址或頁面內容。此外，在工作時段結束時使用 chrome.tabs.create 開啟擴充功能內部的報告頁面。

## 遠端程式碼

本擴充功能不使用任何遠端程式碼。所有程式碼皆為本地的 HTML、CSS 與 JavaScript 檔案，未載入任何外部腳本或程式庫。

## 資料收集

本擴充功能不會收集任何使用者資料。所有資料（包含計時器狀態、工作階段歷史、網站使用時間統計及使用者設定）皆透過 chrome.storage.local 儲存於使用者的本機裝置上，不會傳送至任何外部伺服器。本擴充功能無帳號系統、無註冊流程、無任何形式的資料回傳機制。
