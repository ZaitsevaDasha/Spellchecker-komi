# Komi & Udmurt Spellchecker Browser Extension

Our project is aimed at developing a spellchecker tool in the format of a browser extention for the Komi and Udmurt languages. 

## Current Features
- Spellcheck via highlighting and correction suggestions for Komi 
## Documentation
### Hunspell

### Spellchecker & Suggestions

### Browser extension 
![komi_gifff](https://user-images.githubusercontent.com/55647212/233849072-a1473d1c-273e-42e8-b21d-b3e30a1f313f.gif)

We managed to run spellchecker in the htlm page (see the gif above and the [code](https://github.com/ZaitsevaDasha/Spellchecker-komi/blob/main/komi_html.html)). 

A browser extension requires 3 files:
1. **manifest.json**: metadata, resource definition, etc. 
2. **The service worker**: handles and listens for browser events (background.js based on [this project](https://github.com/MikeCostello/chrome-spellcheck/blob/f2e7f5a9353e82406eb248107d212042c0833476/spell/background.js))
2. **Content script**: execute Javascript in the context of a web page

[Chrome extension Guide](https://developer.chrome.com/docs/extensions/mv3/getstarted/extensions-101/)


### Notes
We also kept track of the work in Russian by [Weekly Meeting Notes](https://www.notion.so/4f0da01751304e15b5a9fba17faa0ef9?v=fc08f97f1841446faa9c9b7285be6efb) in Notion.

## Contributing
We welcome PRs from the community and any contributions to the project!
