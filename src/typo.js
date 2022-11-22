/* globals chrome: false */
/* globals __dirname: false */
/* globals require: false */
/* globals Buffer: false */
/* globals module: false */

/**
 * Typo is a JavaScript implementation of a spellchecker using hunspell-style 
 * dictionaries.
 */


 var Typo;


 (function () {
     "use strict";
 
     /**
      * Typo constructor.
      *
      * @param {String} [dictionary] The locale code of the dictionary being used. e.g.,
      *                              "en_US". This is only used to auto-load dictionaries.
      * @param {String} [affData]    The data from the dictionary's .aff file. If omitted
      *                              and Typo.js is being used in a Chrome extension, the .aff
      *                              file will be loaded automatically from
      *                              lib/typo/dictionaries/[dictionary]/[dictionary].aff
      *                              In other environments, it will be loaded from
      *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].aff
      * @param {String} [wordsData]  The data from the dictionary's .dic file. If omitted
      *                              and Typo.js is being used in a Chrome extension, the .dic
      *                              file will be loaded automatically from
      *                              lib/typo/dictionaries/[dictionary]/[dictionary].dic
      *                              In other environments, it will be loaded from
      *                              [settings.dictionaryPath]/dictionaries/[dictionary]/[dictionary].dic
      * @param {Object} [settings]   Constructor settings. Available properties are:
      *                              {String} [dictionaryPath]: path to load dictionary from in non-chrome
      *                              environment.
      *                              {Object} [flags]: flag information.
      *                              {Boolean} [asyncLoad]: If true, affData and wordsData will be loaded
      *                              asynchronously.
      *                              {Function} [loadedCallback]: Called when both affData and wordsData
      *                              have been loaded. Only used if asyncLoad is set to true. The parameter
      *                              is the instantiated Typo object.
      *
      * @returns {Typo} A Typo object.
      */
 
     Typo = function (dictionary, affData, wordsData, settings) {
         settings = settings || {};
 
         this.dictionary = null;
 
         this.rules = {};
         this.dictionaryTable = {};
 
         this.compoundRules = [];
         this.compoundRuleCodes = {};
 
         this.replacementTable = [];
 
         this.all_stems = [];
 
         this.flags = settings.flags || {};
 
         this.stems = [];
 
         this.memoized = {};
 
         this.loaded = false;

         this.wordsData = wordsData
 
         var self = this;

 
         var path;
 
         // Loop-control variables.
         var i, j, _len, _jlen;
 
         if (dictionary) {
             self.dictionary = dictionary;
 
             // If the data is preloaded, just setup the Typo object.
             if (affData && wordsData) {
                 setup();
             }
             // Loading data for Chrome extentions.
             else if (typeof window !== 'undefined' && 'chrome' in window && 'extension' in window.chrome && 'getURL' in window.chrome.extension) {
                 if (settings.dictionaryPath) {
                     path = settings.dictionaryPath;
                 }
                 else {
                     path = "scr/dictionaries";
                 }
 
                 if (!affData) readDataFile(chrome.extension.getURL(path + "/" + dictionary + "/" + dictionary + ".aff"), setAffData);
                 if (!wordsData) readDataFile(chrome.extension.getURL(path + "/" + dictionary + "/" + dictionary + ".dic"), setWordsData);
                 this.wordlist = readWordlist(chrome.extensiongetURL("scr" + "/" + "wordlist.txt"))
             }
             else {
                 if (settings.dictionaryPath) {
                     path = settings.dictionaryPath;
                 }
                 else if (typeof __dirname !== 'undefined') {
                     path = __dirname + '/dictionaries';
                 }
                 else {
                     path = './dictionaries';
                 }
 
                 if (!affData) readDataFile(path + "/" + dictionary + "/" + dictionary + ".aff", setAffData);
                 if (!wordsData) readDataFile(path + "/" + dictionary + "/" + dictionary + ".dic", setWordsData);
                 this.wordlist = readWordlist(__dirname + "/" + "wordlist.txt")
             }
         }

         function readWordlist(url) {
            var response = self._readFile(url, null, settings.asyncLoad);
            var words = {}
            var i, j, _len, _jlen;
            var lines = response.split(/\r?\n/);
 
            for (i = 0, _len = lines.length; i < _len; i++) {
                var line = lines[i]
                words[line.split(/\t/)[0]] = line.split(/\t/)[1]
            }
            //console.log(words)
            return words
         }
 
         function readDataFile(url, setFunc) {
             var response = self._readFile(url, null, settings.asyncLoad);
 
             if (settings.asyncLoad) {
                 response.then(function (data) {
                     setFunc(data);
                 });
             }
             else {
                 setFunc(response);
             }
         }
 
         function setAffData(data) {
             affData = data;
 
             if (wordsData) {
                 setup();
             }
         }
 
         function setWordsData(data) {
             wordsData = data;
 
             if (affData) {
                 setup();
             }
         }
 
         function setup() {
             self.rules = self._parseAFF(affData);
 
             // Save the rule codes that are used in compound rules.
             self.compoundRuleCodes = {};
 
             for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
                 var rule = self.compoundRules[i];
 
                 for (j = 0, _jlen = rule.length; j < _jlen; j++) {
                     self.compoundRuleCodes[rule[j]] = [];
                 }
             }
 
             // If we add this ONLYINCOMPOUND flag to self.compoundRuleCodes, then _parseDIC
             // will do the work of saving the list of words that are compound-only.
             if ("ONLYINCOMPOUND" in self.flags) {
                 self.compoundRuleCodes[self.flags.ONLYINCOMPOUND] = [];
             
             }
             self.all_stems = wordsData
             // Get rid of any codes from the compound rule codes that are never used 
             // (or that were special regex characters).  Not especially necessary... 
             for (i in self.compoundRuleCodes) {
                 if (self.compoundRuleCodes[i].length === 0) {
                     delete self.compoundRuleCodes[i];
                 }
             }
 
             // Build the full regular expressions for each compound rule.
             // I have a feeling (but no confirmation yet) that this method of 
             // testing for compound words is probably slow.
             for (i = 0, _len = self.compoundRules.length; i < _len; i++) {
                 var ruleText = self.compoundRules[i];
 
                 var expressionText = "";
 
                 for (j = 0, _jlen = ruleText.length; j < _jlen; j++) {
                     var character = ruleText[j];
 
                     if (character in self.compoundRuleCodes) {
                         expressionText += "(" + self.compoundRuleCodes[character].join("|") + ")";
                     }
                     else {
                         expressionText += character;
                     }
                 }
 
                 self.compoundRules[i] = new RegExp(expressionText, "i");
             }
 
             self.loaded = true;
 
             if (settings.asyncLoad && settings.loadedCallback) {
                 settings.loadedCallback(self);
             }
         }
 
         return this;
     };
 
     Typo.prototype = {
         /**
          * Loads a Typo instance from a hash of all of the Typo properties.
          *
          * @param object obj A hash of Typo properties, probably gotten from a JSON.parse(JSON.stringify(typo_instance)).
          */
 
         load: function (obj) {
             for (var i in obj) {
                 if (obj.hasOwnProperty(i)) {
                     this[i] = obj[i];
                 }
             }
 
             return this;
         },
 
         /**
          * Read the contents of a file.
          * 
          * @param {String} path The path (relative) to the file.
          * @param {String} [charset="ISO8859-1"] The expected charset of the file
          * @param {Boolean} async If true, the file will be read asynchronously. For node.js this does nothing, all
          *        files are read synchronously.
          * @returns {String} The file data if async is false, otherwise a promise object. If running node.js, the data is
          *          always returned.
          */
 
         _readFile: function (path, charset, async) {
             charset = charset || "utf8";
 
             if (typeof XMLHttpRequest !== 'undefined') {
                 var promise;
                 var req = new XMLHttpRequest();
                 req.open("GET", path, async);
 
                 if (async) {
                     promise = new Promise(function (resolve, reject) {
                         req.onload = function () {
                             if (req.status === 200) {
                                 resolve(req.responseText);
                             }
                             else {
                                 reject(req.statusText);
                             }
                         };
 
                         req.onerror = function () {
                             reject(req.statusText);
                         }
                     });
                 }
 
                 if (req.overrideMimeType)
                     req.overrideMimeType("text/plain; charset=" + charset);
 
                 req.send(null);
 
                 return async ? promise : req.responseText;
             }
             else if (typeof require !== 'undefined') {
                 // Node.js
                 var fs = require("fs");
 
                 try {
                     if (fs.existsSync(path)) {
                         return fs.readFileSync(path, charset);
                     }
                     else {
                         console.log("Path " + path + " does not exist.");
                     }
                 } catch (e) {
                     console.log(e);
                     return '';
                 }
             }
         },
 
         /**
          * Parse the rules out from a .aff file.
          *
          * @param {String} data The contents of the affix file.
          * @returns object The rules from the file.
          */
 
         _parseAFF: function (data) {
             var rules = {};
 
             var line, subline, numEntries, lineParts;
             var i, j, _len, _jlen;
 
             var lines = data.split(/\r?\n/);
 
             for (i = 0, _len = lines.length; i < _len; i++) {
                 // Remove comment lines
                 line = this._removeAffixComments(lines[i]);
                 line = line.trim();
 
                 if (!line) {
                     continue;
                 }
 
                 var definitionParts = line.split(/\s+/);
 
                 var ruleType = definitionParts[0];
 
                 if (ruleType == "PFX" || ruleType == "SFX") {
                     if (definitionParts[2] == 'SFX' || definitionParts[2] == 'PFX') {
                         var ruleCode = definitionParts[3];
                         var combineable = definitionParts[4];
                         numEntries = parseInt(definitionParts[5], 10);
                     }
                     else {
                         var ruleCode = definitionParts[1];
                         var combineable = definitionParts[2];
                         numEntries = parseInt(definitionParts[3], 10);
                     }
                     var entries = [];
                     if (ruleCode == 'O2'){
                         var x = 5
                     }
                     for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
                         subline = lines[j];
 
                         lineParts = subline.split(/\s+/);
                         if (lineParts[2] == 'SFX' || lineParts[2] == 'PFX') {
                             var subruleType = lineParts[2];
                             var charactersToRemove = lineParts[4];
 
                             var additionParts = lineParts[5].split("/");
                             var regexToMatch = lineParts[6];
                         }
                         else {
                             var subruleType = lineParts[0];
                             var charactersToRemove = lineParts[2];
 
                             var additionParts = lineParts[3].split("/");
                             var regexToMatch = lineParts[4];
                         }
 
 
                         var charactersToAdd = additionParts[0];
                         if (charactersToAdd === "0") charactersToAdd = "";
 
                         var continuationClasses = this.parseRuleCodes(additionParts[1]);
 
                         if (ruleCode == 'Y2') {
                             var x = 1
                         }
                         var entry = {};
                         entry.add = charactersToAdd;
 
                         if (continuationClasses.length > 0) entry.continuationClasses = continuationClasses;
 
                         if (regexToMatch !== ".") {
                             if (subruleType === "SFX") {
                                 entry.match = new RegExp(regexToMatch + "$");
                             }
                             else {
                                 entry.match = new RegExp("^" + regexToMatch);
                             }
                         }
 
                         if (charactersToRemove != "0") {
                             if (subruleType === "SFX") {
                                 entry.remove = new RegExp(charactersToRemove + "$");
                             }
                             else {
                                 entry.remove = charactersToRemove;
                             }
                         }
 
                         entries.push(entry);
                     }
 
                     rules[ruleCode] = { "type": subruleType, "combineable": (combineable == "Y"), "entries": entries };
                     i += numEntries;
                 }
                 else if (ruleType === "COMPOUNDRULE") {
                     numEntries = parseInt(definitionParts[1], 10);
 
                     for (j = i + 1, _jlen = i + 1 + numEntries; j < _jlen; j++) {
                         line = lines[j];
 
                         lineParts = line.split(/\s+/);
                         this.compoundRules.push(lineParts[1]);
                     }
 
                     i += numEntries;
                 }
                 else if (ruleType === "REP") {
                    lineParts = line.split(/\s+/);
				
                    if (lineParts.length === 3) {
                        this.replacementTable.push([ lineParts[1], lineParts[2] ]);
                    }
                     }
                     
                 else {
                     // ONLYINCOMPOUND
                     // COMPOUNDMIN
                     // FLAG
                     // KEEPCASE
                     // NEEDAFFIX
 
                     this.flags[ruleType] = definitionParts[1];
                 }
             }
             return rules;
         },
 
         /**
          * Removes comments.
          *
          * @param {String} data A line from an affix file.
          * @return {String} The cleaned-up line.
          */
 
         _removeAffixComments: function (line) {
             // This used to remove any string starting with '#' up to the end of the line,
             // but some COMPOUNDRULE definitions include '#' as part of the rule.
             // So, only remove lines that begin with a comment, optionally preceded by whitespace.
             line.replace(/\s*#.*/, "");
             return line;
         },
 
         /**
          * Removes comment lines and then cleans up blank lines and trailing whitespace.
          *
          * @param {String} data The data from a .dic file.
          * @return {String} The cleaned-up data.
          */
 
          _removeDicComments: function (data) {
             // I can't find any official documentation on it, but at least the de_DE
             // dictionary uses tab-indented lines as comments.
 
             // Remove comments
             data = data.replace(/\s*#.*/, "");
             return data
         },
 
         separate: function (text) {
             return text.match(/.{1,2}/g);
         },
 
         parseRuleCodes: function (textCodes) {
             if (!textCodes) {
                 return [];
             }
             else {
                 return this.separate(textCodes)
             }
         },
 
         /**
          * Applies an affix rule to a word.
          *
          * @param {String} word The base word.
          * @param {Object} rule The affix rule.
          * @returns {String[]} The new words generated by the rule.
          */
 
         _applyRule2: function (word, rule) {
             var entries = rule.entries;
             var newWords = [];
 
             for (var i = 0, _len = entries.length; i < _len; i++) {
                 var entry = entries[i];
 
                 if (!entry.match || word.match(entry.match)) {
                     var newWord = word;
 
                     if (entry.remove) {
                         newWord = newWord.replace(entry.remove, "");
                     }
 
                     if (rule.type === "SFX") {
                         newWord = newWord + entry.add;
                     }
                     else {
                         newWord = entry.add + newWord;
                     }
 
                     newWords.push(newWord);
 
                     if ("continuationClasses" in entry) {
                         for (var j = 0, _jlen = entry.continuationClasses.length; j < _jlen; j++) {
                             var continuationRule = this.rules[entry.continuationClasses[j]];
 
                             if (continuationRule) {
                                 newWords = newWords.concat(this._applyRule(newWord, continuationRule));
                             }
                             /*
                             else {
                                 // This shouldn't happen, but it does, at least in the de_DE dictionary.
                                 // I think the author mistakenly supplied lower-case rule codes instead 
                                 // of upper-case.
                             }
                             */
                         }
                     }
                 }
             }
             return newWords;
         },
 
         /**
          * Checks whether a word or a capitalization variant exists in the current dictionary.
          * The word is trimmed and several variations of capitalizations are checked.
          * If you want to check a word without any changes made to it, call checkExact()
          *
          * @see http://blog.stevenlevithan.com/archives/faster-trim-javascript re:trimming function
          *
          * @param {String} aWord The word to check.
          * @returns {Boolean}
          */
 
         check: function (aWord) {
             if (!this.loaded) {
                 throw "Dictionary not loaded.";
             }
             var in_word = aWord
             var prefix = false

             if (this.checkExact(this.all_stems, aWord)) {
                return true;
             }
             if (aWord[0] == aWord[0].toUpperCase()){
                var lWord = aWord[0].toLowerCase() + aWord.slice(1)
                if (this.checkExact(this.all_stems, lWord)) {
                    return true;
                 }
             }
             if (this.checkExact(this.all_stems, aWord)) {
                return true;
             }

             if (aWord.slice(0, 4) == 'меді'){
                aWord = 'и' + aWord.slice(4,)
                prefix = true
             }

             if (aWord.slice(0, 4) == 'медъ'){
                aWord = aWord.slice(4,)
                prefix = true
                if (!aWord.match(/^[юёея]/)) {
                    return false;
                }
             }

             if (aWord.slice(0, 3) == 'мед'){
                prefix = true
                aWord = aWord.slice(3,)
                if (!aWord.match(/^[^еёюяи]/)){
                    return false;
                }
             }

             if (aWord.slice(0, 2) == 'не'){
                prefix = true
                aWord = aWord.slice(2,)
             }

             if (prefix == true){
                if (this.checkExact(this.all_stems, aWord)){
                    return true
                }
             }
             return false
             
         },
 
         /**
          * Checks whether a word exists in the current dictionary.
          * @param {String} data
          * @param {String} word The word to check.
          * @returns {Boolean}
          */
 
         checkExact: function (data, word) {
             var possible_stems = [];
             var lines = data.split(/\r?\n/);
             var i, _len;
             for (i = 0, _len = lines.length; i < _len; i++) {
                var line = lines[i];
                var parts = line.split("/");
                var stems = []
                var orig_stem = parts[0];
                if (parts.length == 3){
                    var stems = parts[1].split(/\s/)
                    var codes = parts[2]
                    if (word.startsWith(orig_stem)) {
                        possible_stems.push([orig_stem, codes])
                     }
                    var j, jlen
                    for(j = 0, jlen = stems.length; j < jlen; j++) {
                        if (word.startsWith(stems[j])) {
                            possible_stems.push([orig_stem, codes])
                        }
                    }
                }
                else if (parts.length == 2) {
                    var codes = parts[1]
                    if (word.startsWith(orig_stem)) {
                        possible_stems.push([orig_stem, codes])
                     }
                }
                else{
                    if (parts[0] == word){
                        return true
                    }
                }     
             }
             //console.log(possible_stems)
             var s, _slen;
             for (s = 0, _slen = possible_stems.length; s < _slen; s++) {
                 var cur_word = possible_stems[s][0];
                 if (possible_stems[s].length > 1){
                    var codes = possible_stems[s][1];
                    codes = this.parseRuleCodes(codes)
                    var k, k_len
                    for (k = 0, k_len = codes.length; k < k_len; k++) {
                        var code = codes[k]
                        if (code == 'V2'){
                            continue
                        }
                        var rule = this.rules[code];
                        if (this._applyRule(cur_word, rule, word, code)) {
                            return true
                    }
                 }
                }
                 else{
                     if (possible_stems[s][0] == word){
                         return true
                     }
                 }
 
             }
             return false
         },
 
         _applyRule: function (word, rule, aword, code, replace) {
             var entries = rule.entries;
             var newWords = [];
             for (var i = 0, _len = entries.length; i < _len; i++) {
                var entry = entries[i];
                 if (!entry.match || word.match(entry.match)) {
                     var newWord = word;

                    if (entry.remove) {
                        newWord = newWord.replace(entry.remove, "");
                    }
 
                     if (rule.type === "SFX") {
                         newWord = newWord + entry.add;
                     }
                     else {
                         newWord = entry.add + newWord;
                     }
                     if (newWord == aword) {
                        return true
                     }
                     if ("continuationClasses" in entry) {
                         for (var j = 0, _jlen = entry.continuationClasses.length; j < _jlen; j++) {
                             var continuationRule = this.rules[entry.continuationClasses[j]];
 
                             if (continuationRule) {
                                 if (this._applyRule(newWord, continuationRule, aword, entry.continuationClasses[j], replace)) {
                                     return true
                                 }
                             }
                         }
                     }
                }
             }
         },
 
 
         /**
          * Looks up whether a given word is flagged with a given flag.
          *
          * @param {String} word The word in question.
          * @param {String} flag The flag in question.
          * @return {Boolean}
          */
 
         hasFlag: function (word, flag, wordFlags) {
             if (!this.loaded) {
                 throw "Dictionary not loaded.";
             }
 
             if (flag in this.flags) {
                 if (typeof wordFlags === 'undefined') {
                     wordFlags = Array.prototype.concat.apply([], this.dictionaryTable[word]);
                 }
 
                 if (wordFlags && wordFlags.indexOf(this.flags[flag]) !== -1) {
                     return true;
                 }
             }
 
             return false;
         },
 
         /**
          * Returns a list of suggestions for a misspelled word.
          *
          * @see http://www.norvig.com/spell-correct.html for the basis of this suggestor.
          * This suggestor is primitive, but it works.
          *
          * @param {String} word The misspelling.
          * @param {Number} [limit=5] The maximum number of suggestions to return.
          * @returns {String[]} The array of suggestions.
          */
 
         alphabet: "",
 
         suggest: function (word, limit) {
            if (arguments.length===0) return;
            const levenshteinDistance = (s, t) => {
                if (!s.length) return t.length;
                if (!t.length) return s.length;
                const arr = [];
                for (let i = 0; i <= t.length; i++) {
                  arr[i] = [i];
                  for (let j = 1; j <= s.length; j++) {
                    arr[i][j] =
                      i === 0
                        ? j
                        : Math.min(
                            arr[i - 1][j] + 1,
                            arr[i][j - 1] + 1,
                            arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
                          );
                  }
                }
                return arr[t.length][s.length];
              };

              const applyrule2 = (word, code, aword) => {
                var rule = this.rules[code]
                var entries = rule.entries;
                for (var i = 0, _len = entries.length; i < _len; i++) {
                    var entry = entries[i];
                    if (!entry.match || word.match(entry.match)) {
                        var newWord = word;

                        if (entry.remove) {
                            newWord = newWord.replace(entry.remove, "");
                        }
 
                        if (rule.type === "SFX") {
                            newWord = newWord + entry.add;
                        }
                        else {
                            newWord = entry.add + newWord;
                     }
                     var dist = levenshteinDistance(newWord, aword)
                     if ((dist <= 2) & !(only_suggestions.includes(newWord))) {
                        suggestions.push([newWord, dist])
                        only_suggestions.push(newWord)
                     }
                }
             }
            }

             if (this.check(word) == false){
                var suggestions = []
                var only_suggestions = []
                var all_stems = [];
                var data = this._removeDicComments(this.all_stems)
                var lines = data.split(/\r?\n/);
                var i, _len;
                for (i = 0, _len = lines.length; i < _len; i++) {
                   var line = lines[i];
                   var parts = line.split("/");
                   var stem = parts[0];
                   if (parts.length == 3){
                       codes = parts[2]
                       var stem_vars = parts[1].split(' ')
                       stem_vars.forEach(function(item, i, stem_vars) {
                        if (levenshteinDistance(item, word) <= 2){
                            all_stems.push([stem, codes])
                        }
                      })
                   }
                   else if (parts.length == 2){
                       codes = parts[1]
                   }
                   else{
                        var dist = levenshteinDistance(stem, word.slice(0, stem.length))
                        if (levenshteinDistance(stem, word.slice(0, stem.length)) <= 2){
                             suggestions.push([stem, dist])
                             continue  
                        }
                        else
                            continue
                   }
                   if (levenshteinDistance(stem, word.slice(0, stem.length)) <= 2){
                        all_stems.push([stem, codes])
                   }
                   }
                //console.log(all_stems)
                var s, _slen;
                for (s = 0, _slen = all_stems.length; s < _slen; s++) {
                    var cur_word = all_stems[s][0];
                       var codes = all_stems[s][1];
                       codes = this.parseRuleCodes(codes)
                       var k, k_len
                       for (k = 0, k_len = codes.length; k < k_len; k++) {
                           var code = codes[k];
                           if (code == 'V2'){
                                continue
                            }
                            applyrule2(cur_word, code, word)
                    }
                }
                function compare(wordlist) {
                    return function(a, b) {
                    if (!(a[0] in wordlist)){
                        wordlist[a[0]] = 0
                    }
                    if (!(b[0] in wordlist)){
                        wordlist[b[0]] = 0
                    }  
                    return  a[1] - b[1] || wordlist[b[0]] - wordlist[a[0]]
                    }
                }
                suggestions.sort(compare(this.wordlist))
                var only_sugg = []
                suggestions.forEach(function(item, i) {
                    if (i <= 4){
                        only_sugg.push(item[0])
                    }
                });
                return only_sugg
                }
	        else
             	return []
            
            
         }
     };
 })();
 
 // Support for use as a node.js module.
 if (typeof module !== 'undefined') {
     module.exports = Typo;
 }
