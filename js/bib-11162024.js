function BibtexParser() {
  this.pos = 0;
  this.input = "";
  this.entries = {};
  this.strings = {
    JAN: "January",
    FEB: "February",
    MAR: "March",
    APR: "April",
    MAY: "May",
    JUN: "June",
    JUL: "July",
    AUG: "August",
    SEP: "September",
    OCT: "October",
    NOV: "November",
    DEC: "December"
  };
  this.currentKey = "";
  this.currentEntry = "";
  this.setInput = function (t) {
    this.input = t;
  }
  this.getEntries = function () {
    return this.entries;
  }
  this.isWhitespace = function (s) {
    return (s == ' ' || s == '\r' || s == '\t' || s == '\n');
  }
  this.match = function (s) {
    this.skipWhitespace();
    if (this.input.substring(this.pos, this.pos + s.length) == s) {
      this.pos += s.length;
    } else {
      throw "Token mismatch, expected " + s + ", found " + this.input.substring(this.pos);
    }
    this.skipWhitespace();
  }
  this.tryMatch = function (s) {
    this.skipWhitespace();
    if (this.input.substring(this.pos, this.pos + s.length) == s) {
      return true;
    } else {
      return false;
    }
    this.skipWhitespace();
  }
  this.skipWhitespace = function () {
    while (this.isWhitespace(this.input[this.pos])) {
      this.pos++;
    }
    if (this.input[this.pos] == "%") {
      while (this.input[this.pos] != "\n") {
        this.pos++;
      }
      this.skipWhitespace();
    }
  }
  this.value_braces = function () {
    var bracecount = 0;
    this.match("{");
    var start = this.pos;
    while (true) {
      if (this.input[this.pos] == '}' && this.input[this.pos - 1] != '\\') {
        if (bracecount > 0) {
          bracecount--;
        } else {
          var end = this.pos;
          this.match("}");
          return this.input.substring(start, end);
        }
      } else if (this.input[this.pos] == '{') {
        bracecount++;
      } else if (this.pos == this.input.length - 1) {
        throw "Unterminated value";
      }
      this.pos++;
    }
  }
  this.value_quotes = function () {
    this.match('"');
    var start = this.pos;
    while (true) {
      if (this.input[this.pos] == '"' && this.input[this.pos - 1] != '\\') {
        var end = this.pos;
        this.match('"');
        return this.input.substring(start, end);
      } else if (this.pos == this.input.length - 1) {
        throw "Unterminated value:" + this.input.substring(start);
      }
      this.pos++;
    }
  }
  this.single_value = function () {
    var start = this.pos;
    if (this.tryMatch("{")) {
      return this.value_braces();
    } else if (this.tryMatch('"')) {
      return this.value_quotes();
    } else {
      var k = this.key();
      if (this.strings[k.toUpperCase()]) {
        return this.strings[k];
      } else if (k.match("^[0-9]+$")) {
        return k;
      } else {
        throw "Value expected:" + this.input.substring(start);
      }
    }
  }
  this.value = function () {
    var values = [];
    values.push(this.single_value());
    while (this.tryMatch("#")) {
      this.match("#");
      values.push(this.single_value());
    }
    return values.join("");
  }
  this.key = function () {
    var start = this.pos;
    while (true) {
      if (this.pos == this.input.length) {
        throw "Runaway key";
      }
      if (this.input[this.pos].match("[a-zA-Z0-9_:\\./-]")) {
        this.pos++
      } else {
        return this.input.substring(start, this.pos).toUpperCase();
      }
    }
  }
  this.key_equals_value = function () {
    var key = this.key();
    if (this.tryMatch("=")) {
      this.match("=");
      var val = this.value();
      return [key, val];
    } else {
      throw "... = value expected, equals sign missing:" + this.input.substring(this.pos);
    }
  }
  this.key_value_list = function () {
    var kv = this.key_equals_value();
    this.entries[this.currentEntry][kv[0]] = kv[1];
    while (this.tryMatch(",")) {
      this.match(",");
      if (this.tryMatch("}")) {
        break;
      }
      kv = this.key_equals_value();
      this.entries[this.currentEntry][kv[0]] = kv[1];
    }
  }
  this.entry_body = function () {
    this.currentEntry = this.key();
    this.entries[this.currentEntry] = new Object();
    this.entries[this.currentEntry]["TAG"] = this.currentEntry;
    this.match(",");
    this.key_value_list();
  }
  this.directive = function () {
    this.match("@");
    return "@" + this.key();
  }
  this.string = function () {
    var kv = this.key_equals_value();
    this.strings[kv[0].toUpperCase()] = kv[1];
  }
  this.preamble = function () {
    this.value();
  }
  this.comment = function () {
    this.value();
  }
  this.entry = function () {
    this.entry_body();
  }
  this.bibtex = function () {
    while (this.tryMatch("@")) {
      this.posBegin = this.pos;
      var d = this.directive().toUpperCase();
      this.match("{");
      if (d == "@STRING") {
        this.string();
      } else if (d == "@PREAMBLE") {
        this.preamble();
      } else if (d == "@COMMENT") {
        this.comment();
      } else {
        this.entry();
        this.entries[this.currentEntry]["BIBTEXCODE"] = this.input.substring(this.posBegin, this.pos + 1);
      }
      this.match("}");
    }
  }
}

function BibtexDisplay() {
  this.fixValue = function (value) {
    value = value.replace(/\\glqq\s?/g, "&bdquo;");
    value = value.replace(/\\grqq\s?/g, '&rdquo;');
    value = value.replace(/\\ /g, '&nbsp;');
    value = value.replace(/\\url/g, '');
    value = value.replace(/---/g, '&mdash;');
    value = value.replace(/{\\"a}/g, '&auml;');
    value = value.replace(/\\'{e}/g, 'é');
    value = value.replace(/\\~{a}/g, 'ã');
    value = value.replace(/\{\\"o\}/g, '&ouml;');
    value = value.replace(/{\\"u}/g, '&uuml;');
    value = value.replace(/{\\"A}/g, '&Auml;');
    value = value.replace(/{\\"O}/g, '&Ouml;');
    value = value.replace(/{\\"U}/g, '&Uuml;');
    value = value.replace(/\\ss/g, '&szlig;');
    value = value.replace(/\{(.*?)\}/g, '$1');
    return value;
  }
  this.displayBibtex = function (input, output) {
    var b = new BibtexParser();
    b.setInput(input);
    b.bibtex();
    var yearOfPreviousEntry = undefined;
    var old = output.find("*");
    var entries = b.getEntries();
    for (var entryKey in entries)
      if (!entries[entryKey]["BIBTEXCODE"].startsWith("@proceedings{")) {
        var entry = entries[entryKey];
        if (entry["YEAR"] != yearOfPreviousEntry) {
          yearOfPreviousEntry = entry["YEAR"];
        }
        var tpl = $(".bibtex_template").clone().removeClass('bibtex_template');
        var keys = [];
        for (var key in entry) {
          keys.push(key.toUpperCase());
        }
        var removed = false;
        do {
          var conds = tpl.find(".if");
          if (conds.size() == 0) {
            break;
          }
          var cond = conds.first();
          cond.removeClass("if");
          var ifTrue = true;
          var classList = cond.attr('class').split(' ');
          $.each(classList, function (index, cls) {
            if (keys.indexOf(cls.toUpperCase()) < 0) {
              ifTrue = false;
            }
            cond.removeClass(cls);
          });
          if (!ifTrue) {
            cond.remove();
          }
        } while (true);
        for (var index in keys) {
          var key = keys[index];
          var value = entry[key] || "";
          tpl.find("span:not(a)." + key.toLowerCase()).html(this.fixValue(value));
          tpl.find("a." + key.toLowerCase()).attr('href', this.fixValue(value));
        }
        abstCode = entry['BIBTEXCODE'];
				abstRepl = abstCode.replace(/(.|\n)*abst\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2");
        tpl.find('.abst_link').attr("abstcode", abstRepl);
        tpl.find('.abst_link').click(function () {
          alert($(this).attr("abstcode"));
        });
        bibTexCode = entry['BIBTEXCODE'];
				bibTexRepl = bibTexCode.replace(/\s\sauth\s(.*?)(\n|$)/g,"");
				bibTexRepl = bibTexRepl.replace(/\s\sauth\s(.*?)(\n|$)/g,"");
				bibTexRepl = bibTexRepl.replace(/\s\sproc\s(.*?)(\n|$)/g,"");
				bibTexRepl = bibTexRepl.replace(/\s\sabst\s(.*?)(\n|$)/g,"");
				bibTexRepl = bibTexRepl.replace(/\s\splnk\s(.*?)(\n|$)/g,"");
				bibTexRepl = bibTexRepl.replace(/\s\sflnk\s(.*?)(\n|$)/g,"");
        tpl.find('.bibt_link').attr("bibtexcode", bibTexRepl);
        tpl.find('.bibt_link').click(function () {
          alert($(this).attr("bibtexcode"));
        });
        tpl.find('.plnk_link').attr("href", bibTexCode.replace(/(.|\n)*plnk\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2"));
        tpl.find('.flnk_link').attr("href", bibTexCode.replace(/(.|\n)*flnk\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2"));
        output.append(tpl);
        tpl.show();
      }
    old.remove();
  }
}

function BibtexDisplayOnly() {
  this.fixValue = function (value) {
    value = value.replace(/\\glqq\s?/g, "&bdquo;");
    value = value.replace(/\\grqq\s?/g, '&rdquo;');
    value = value.replace(/\\ /g, '&nbsp;');
    value = value.replace(/\\url/g, '');
    value = value.replace(/---/g, '&mdash;');
    value = value.replace(/{\\"a}/g, '&auml;');
    value = value.replace(/\\'{e}/g, 'é');
    value = value.replace(/\\~{a}/g, 'ã');
    value = value.replace(/\{\\"o\}/g, '&ouml;');
    value = value.replace(/{\\"u}/g, '&uuml;');
    value = value.replace(/{\\"A}/g, '&Auml;');
    value = value.replace(/{\\"O}/g, '&Ouml;');
    value = value.replace(/{\\"U}/g, '&Uuml;');
    value = value.replace(/\\ss/g, '&szlig;');
    value = value.replace(/\{(.*?)\}/g, '$1');
    return value;
  }
  this.displayBibtex = function (input, output) {
    var b = new BibtexParser();
    b.setInput(input);
    b.bibtex();
    var yearOfPreviousEntry = undefined;
    var old = output.find("*");
    var entries = b.getEntries();
    for (var entryKey in entries)
      if (!entries[entryKey]["BIBTEXCODE"].startsWith("@proceedings{")) {
        var entry = entries[entryKey];
        if (entry["YEAR"] != yearOfPreviousEntry) {
          yearOfPreviousEntry = entry["YEAR"];
        }
        var tpl = $(".bibtex_template").clone().removeClass('bibtex_template');
        var keys = [];
        for (var key in entry) {
          keys.push(key.toUpperCase());
        }
        var removed = false;
        do {
          var conds = tpl.find(".if");
          if (conds.size() == 0) {
            break;
          }
          var cond = conds.first();
          cond.removeClass("if");
          var ifTrue = true;
          var classList = cond.attr('class').split(' ');
          $.each(classList, function (index, cls) {
            if (keys.indexOf(cls.toUpperCase()) < 0) {
              ifTrue = false;
            }
            cond.removeClass(cls);
          });
          if (!ifTrue) {
            cond.remove();
          }
        } while (true);
        for (var index in keys) {
          var key = keys[index];
          var value = entry[key] || "";
          tpl.find("span:not(a)." + key.toLowerCase()).html(this.fixValue(value));
          tpl.find("a." + key.toLowerCase()).attr('href', this.fixValue(value));
        }
        abstCode = entry['BIBTEXCODE'];
        abstRepl = abstCode.replace(/(.|\n)*abst\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2");
        tpl.find('.abst_link').attr("abstcode", abstRepl);
        tpl.find('.abst_link').click(function () {
          alert($(this).attr("abstcode"));
        });
        bibTexCode = entry['BIBTEXCODE'];
        bibTexRepl = bibTexCode.replace(/\s\sauth\s(.*?)(\n|$)/g,"");
        bibTexRepl = bibTexRepl.replace(/\s\sauth\s(.*?)(\n|$)/g,"");
        bibTexRepl = bibTexRepl.replace(/\s\sproc\s(.*?)(\n|$)/g,"");
        bibTexRepl = bibTexRepl.replace(/\s\sabst\s(.*?)(\n|$)/g,"");
        bibTexRepl = bibTexRepl.replace(/\s\splnk\s(.*?)(\n|$)/g,"");
        bibTexRepl = bibTexRepl.replace(/\s\sflnk\s(.*?)(\n|$)/g,"");
        tpl.find('.bibt_link').attr("bibtexcode", bibTexRepl);
        tpl.find('.bibt_link').click(function () {
          alert($(this).attr("bibtexcode"));
        });
        tpl.find('.plnk_link').attr("href", bibTexCode.replace(/(.|\n)*plnk\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2"));
        tpl.find('.flnk_link').attr("href", bibTexCode.replace(/(.|\n)*flnk\s=\s{(.*?)(},(.|\n)*|$)/mg,"$2"));
        output.find('.abst_link').click(function () {
          alert($(this).attr("abstcode"));
        });
        output.find('.bibt_link').click(function () {
          alert($(this).attr("bibtexcode"));
        });
      }
  }
}

function bibtexShow(bibtexCode, div) {
  (new BibtexDisplay()).displayBibtex(bibtexCode, div);
}

function bibtexShowOnly(bibtexCode, div) {
  (new BibtexDisplayOnly()).displayBibtex(bibtexCode, div);
}

function bibtex_js_draw(bibtexFileContent, id) {
  $(".bibtex_template").hide();
  bibtexShow(bibtexFileContent, $(id));
}

function bibtex_js_draw_only(bibtexFileContent, id) {
  $(".bibtex_template").hide();
  bibtexShowOnly(bibtexFileContent, $(id));
}

if (typeof jQuery == 'undefined') {
  alert("Please include jquery in all pages using bibtex_js!");
} else {
  $(document).ready(function () {
    fetch('bib/conf-11022023.bib')
      .then(response => response.text())
      .then((data) => {
        bibtex_js_draw(data, "#bibtex_display_conf");
      });
    fetch('bib/work-11022023.bib')
      .then(response => response.text())
      .then((data) => {
        bibtex_js_draw(data, "#bibtex_display_work");
      });
    fetch('bib/jour-11022023.bib')
      .then(response => response.text())
      .then((data) => {
        bibtex_js_draw(data, "#bibtex_display_jour");
      });
    fetch('bib/thes-11022023.bib')
      .then(response => response.text())
      .then((data) => {
        bibtex_js_draw(data, "#bibtex_display_thes");
      });
  });
}
