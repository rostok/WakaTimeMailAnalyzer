process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

var math = require('mathjs');
var imaps = require('imap-simple');
var fs = require('fs');
var credentials = require('./credentials');

var config = {
  inbox: credentials.inbox, 
  filterMinimalHours: 2,
  debug: process.argv.join(' ').includes(" -debug"),
  imap: {
    user: credentials.user, 
    password: credentials.password, 
    host: credentials.host, 
    port: 993,
    tls: true,
    authTimeout: 10000
  }
};

// in case password is empty ask for it safely
if (config.imap.password=='') {
  var readlineSync = require('readline-sync');
  config.imap.password = readlineSync.question('inbox password:', { hideEchoBack: true });
}

// this will hold projects, single project has 'total' property with total number of hours and week-end dates properties with hours spend on that weeks  
var projects = {};

// silly little function
function betw(src, beg, end) {
  src = src.split(beg);
  if (src.length <= 1) return src[0];
  src.shift();
  src = src.join("beg");
  src = src.split(end);
  return src[0];
}

console.log("connecting.");
imaps.connect(config).then(function (connection) {

  return connection.openBox(config.inbox).then(function () {
    console.log("connected.");
    var searchCriteria = [
      ['FROM', 'WakaTime'],
      ['SUBJECT', 'weekly'],
//      ['SUBJECT', 'WakaTime'],
      ['!SUBJECT', 'no coding activity']
    ];

    var fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false
    };

    return connection.search(searchCriteria, fetchOptions).then(function (results) {
      console.log("searching.");
      results.map(function (res) {
        var s = res.parts.filter(function (part) {
          return part.which === 'HEADER';
        })[0].body.subject[0];

        if (config.debug) console.log (s+" / " + res.attributes.date.toISOString());
        var t = res.parts.filter(function (part) {
          return part.which === 'TEXT';
        })[0].body;

        var w = s.split("until").pop().trim();
        p = betw(t, 'Projects:', 'Languages').trim();
        p = p.split("\n");
        p.map(pr => {
          pr = pr.trim();
          var d = [];
          if (pr.indexOf("\t") != -1) {
            d = pr.split("\t");
          } else
          if (pr.indexOf(" : ") != -1) {
            d = pr.split(" : ");
          } else
            return;
          d[0] = d[0].replace("'", "");
          d[0] = d[0].replace('"', "");
          var q = d[1];
          q = q.replace("hrs", "*60*60+");
          q = q.replace("hr", "*60*60+");
          q = q.replace("mins", "*60+");
          q = q.replace("min", "*60+");
          q = q.replace("secs", "+");
          q = q.replace("sec", "+");
          q += "0";
          d[1] = math.evaluate(q) / 3600;
          if (typeof projects[d[0]] === 'undefined') projects[d[0]] = {
            total: 0
          };
          projects[d[0]].total += d[1];
          projects[d[0]][w] = d[1];
          if (config.debug) console.log("\t"+d[0]+":"+d[1]);
        })
      });
    }).then(() => {
      console.log("accumulating.");
      //console.log(projects);
      var weeks = Object.keys(projects);
      weeks = weeks.reduce((arr, val) => {
        return arr.concat(Object.keys(projects[val]));
      }, []);
      weeks = weeks.filter((v, i, a) => a.indexOf(v) === i);
      weeks = weeks.filter(v => v != 'total').sort();

      html = `<html>
      <head>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.css" rel="stylesheet">
    	<script src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
    	<script src='https://d3js.org/d3.v3.min.js'></script>
    	<script src='https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.min.js'></script>
        <script type="text/javascript">
            var data = [\n`;

      header = Object.keys(projects).sort().filter(p => projects[p].total > config.filterMinimalHours);
      projectNames = header.concat();
      header.unshift('week');
      header = header.map(p => `'${p}'`).join(',');
      html += `[` + header + `],\n`;

      weeks.map(w => {
        var oneWeek = [];
        oneWeek.push("'" + w + "'");

        projectNames.map(pn => {
          var tot = projects[pn][w];
          if (tot == undefined) tot = 0;
          oneWeek.push(tot);
        });
        oneWeek = oneWeek.join(',');
        html += `[` + oneWeek + `],\n`;
      });

      html += `              
            ]
    
            var arr = [];
            var tickVals = [];
            for (var ki=1; ki<data[0].length; ki++)
            {
            	var va = [];
                for (var vi=1; vi<data.length; vi++)
                {
                	va[va.length] = [data[vi][0], data[vi][ki]];
                	if(vi%3==0)tickVals[vi-1] = (new Date(data[vi][0])).valueOf();
                }
            	var o = {key:data[0][ki], values:va};
            	arr[arr.length] = o;
            }

      nv.addGraph(function() {
        var chart = nv.models.stackedAreaChart()
                    .x(function(d) { return (new Date(d[0])).valueOf() })
                    .y(function(d) { return parseFloat(d[1]) })
                    .useInteractiveGuideline(true)
                    .clipEdge(true);
		chart1 = chart;
        chart.xAxis
            //.tickValues(tickVals)
            .tickFormat(function(d) { 
            	//console.log("xAxis",d); 
            	return d3.time.format('%Y-%m-%d')(new Date(d)) 
            })
            ;
        chart.yAxis
            .tickFormat(d3.format(',.0f'));

        d3.select('#chart_div svg')
          .datum(arr)
          .transition().duration(500).call(chart);

        nv.utils.windowResize(chart.update);

        return chart;
      });
	
	function patience() {
		if(typeof chart1 !== 'undefined'){ 
			chart1.xAxis.rotateLabels(-30);
			chart1.update(); 
		} else 
			setTimeout(patience, 250);
	}
	patience();

        </script>              
      </head>
      <body>
        <div id='chart_div' style='width: 100%'><svg style='background-color:#eee;width:100%;height:500px'></svg></div>
        <div>`;

      projectNames.map( p=> html += "<br>"+p+" : "+Math.round(projects[p].total,1) );

      html += `              
        </div>
    </body>
    </html>`;
      fs.writeFileSync("chart-nv.html", html, {flag:"w"});
      console.log("saved results to chart.html");
      console.log("opening browser");
      var opn = require('opn');
      opn(__dirname+"chart-nv.html", {app: 'chrome'}).then(() => {
      	process.exit();
	  });
    });
  });
});