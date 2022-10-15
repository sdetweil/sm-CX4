const mname="CX4"
angular.module('SmartMirror')
	.controller(mname, ($scope, $interval, CalendarService, WeatherService, $rootScope)=>{

		Date.prototype.getWeek = function () {
		    var target  = new Date(this.valueOf());
		    var dayNr   = (this.getDay() + 6) % 7;
		    target.setDate(target.getDate() - dayNr + 3);
		    var firstThursday = target.valueOf();
		    target.setMonth(0, 1);
		    if (target.getDay() != 4) {
		        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
		    }
		    return 1 + Math.ceil((firstThursday - target) / 604800000);
		}


		// get parms from config
		let first_week_offset= +config[mname].week_offset || -1
		let weeks_to_view=    +config[mname].weeks_to_view|| 2
			if(weeks_to_view===1){
			 if(first_week_offset<0){
				first_week_offset=0
			 }
			} 
		let mode= config[mname].mode || "week"
		let fontsize =   (config[mname].fontsize  || 14) +"px" 
		let maxeventlines= (config[mname].maxeventlines || 6 )
		let firsttime=true
		let days= [] 

		let v= {

				// config passed parms
				display_week_number:config[mname].display_week_number ,
				display_weather_info: config[mname].display_weather ,
				first_day_of_week: config[mname].firstDayOfWeek || 0,
				timeline:false,
				schedule:true,

				container:{
					classes:'bodice '+mname+'_' + 1 + ' ' +mname+ ' mode_' + mode,
					styles:"--fontsize:"+fontsize +"; --maxeventlines:"+maxeventlines+"; position: absolute;   z-index: 1; height:75vh;",
				},
				currentWeek:0,
				useSymbol: !!config[mname].useSymbol? parseInt(config[mname].useSymbol):false,
				symbolName:config[mname].symbol_name ||"calendar-check",
				instance: {id:mname+'_' + 1},

				todays_week_number:0,
				weeks:[],
				week_days:[0,1,2,3,4,5,6],
				days_of_week:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],
				floor:Math.floor,
				}

				$scope[mname]=v

				if($scope[mname].first_day_of_week!=0){
					let old=$scope[mname].days_of_week.splice(0,$scope[mname].first_day_of_week)
					$scope[mname].days_of_week=$scope[mname].days_of_week.concat(old)
				}

				$scope[mname].now=moment()

				// watch for day change ,each second tick event from main controller
				$scope.$on("clock-tick",(event,tickmoment)=>{
					if($scope[mname].now.format("DD") !== tickmoment.format("DD") || firsttime){
						firsttime = false;
						// date changed
						// recalc days array
						$scope[mname].now = tickmoment
						refreshDisplay()
					}
				})

				// used on weather update event and overnight day change
				updateWeather=((weatherData)=>{
					if(weatherData && weatherData.weekly){
						//console.log("have weekly data ="+JSON.stringify(data.weekly,null,2))
						for ( let i in weatherData.weekly.data){
							let forecastDay = weatherData.weekly.data[i]
							let m = moment.utc(forecastDay.dt*1000)
							//console.log("forecast day="+m.format("YYYY:MM:DD")+" temp min="+forecastDay.temp.min+" temp max="+forecastDay.temp.max)
							let fd = m.format('DD')
							for(d of days){
								if(d.date.format('DD')==fd){
									d.forecast={icon:weatherData.weekly.data[i].wi,min:weatherData.weekly.data[i].temperatureMin, max:weatherData.weekly.data[i].temperatureMax}	
									break;
								}
							}
							$scope.$apply()
						}
					}
				})
				// watch for weather update event, from weather plugin
				$scope.$on('weather',(event,weather_data)=>{
					//console.log("received weather data change trigger")
					// if we are displaying weather info 
					if($scope[mname].display_weather_info){
						$scope[mname].weatherData=weather_data
						updateWeather($scope[mname].weatherData)
					}

				})	
				// used on calendar refresh and overnight day change
				updateCalendar=((events)=>{
					if(events){
					// loop thru and apportion by date
						days.forEach(d=>{
							d.events=[]
							// loop thru the smaller number of events
							events.forEach(event=>{
								//console.log("comparing "+d.date.format("YYYY:MM:DD HH:MM A")+" with "+ event.start.format("YYYY:MM:DD HH:MM A"+" title "+event.SUMMARY))
								// if this event starts this day, or ends this day
								// date.diff isn't working)
								if(event.start.format("YYYY:MM:DD") === d.date.format("YYYY:MM:DD") || event.end.format("YYYY:MM:DD") ===d.date.format("YYYY:MM:DD")) {
									//console.log("Matching event day="+d.date.format("YYYY:MM:DD HH:mm A")+ " event start="+event.start.format("YYYY:MM:DD HH:mm A")+" event end="+event.end.format("YYYY:MM:DD HH:mm A"))
									// add it to the days events
									d.events.push(event)
								}
							})
							// sort when there is more than one event per day
							if(d.events.length>1){
								d.events=d.events.sort(function(a,b){
									var da = new Date(a.start).getTime();
	            					var db = new Date(b.start).getTime();

	            					return da < db ? -1 : da > db ? 1 : 0
	            				});
							}
						})
					}
				})
				// watch for calendar refresh event, from calendar plugin
				$scope.$on('calendar',()=>{
					// events ready (pulled from web calendar)
					// past events is large, filter out the garbage
					let pastevents=[]
					let futureevents= CalendarService.getFutureEvents($scope[mname].days.length,-1)
					let allpastevents=CalendarService.getPastEvents()

					if($scope[mname].days && $scope[mname].days.length){
						let caf_first_day=$scope[mname].days[0].date
 						for(let i = allpastevents.length-1;i>0;i--){
							let Event = allpastevents[i]
							if(Event.start.diff(caf_first_day) >=0  
										||
							        (Event.end.isAfter(caf_first_day) &&
							        	Event.start.isBefore(caf_first_day))){
								pastevents.unshift(Event)
							} else {
								// events not in any particular order.. can't end loop til we go thru them all
								//break;
							}
						}

					// loop thu the days once
					// make one list
					$scope[mname].calendar_events=pastevents.concat(futureevents)
					updateCalendar($scope[mname].calendar_events)
					}

				}, true)

				// all the work to build the data for the template
				refreshDisplay = ()=>{
					return new Promise((resolve,reject)=>{
						//let_day_of_week= $scope[mname].now.isoWeekday()
						let today=+$scope[mname].now.format('DD')
						let todays_week_number=(new Date()).getWeek()
						let day_of_week_first= (new Date(+$scope[mname].now.format('YYYY'), +$scope[mname].now.format('MM')-1, 1)).getDay()
						if(mode==="month"){
							// (weeks is days + offset of 1st day in week )/7
							// 28+6 (saturday)=34/7=4+remainder (5)
							// 28+0 (sunday=28/7=4, no remainder) (4)
							// 30 + 0 = 30/7=4+ = 5
							// 31 + 6 = 37/7=5+=6 
							weeks_to_view=Math.ceil((day_of_week_first+new Date("0").getDate())/7)==0?3:4
							first_week_offset = Math.floor((today+day_of_week_first)/7)
							//console.log(" month view first week = "+today+ " floor="+ (Math.floor(today/7)-1)*-1)
						}

						for(let i =0; i<weeks_to_view;i++){
							$scope[mname].weeks.push(i)
						}
						$scope[mname].week_number_list=[]
						//let save_week_number=todays_week_number
						for(let x=first_week_offset<0?-1:0 ; x<weeks_to_view;x++){
							//$scope[mname].weeks.push(x)

							$scope[mname].week_number_list.push(todays_week_number+x); 

						}
						//todays_week_number=save_week_number
						// -1, weeks 2 
						//    0,1  ( current week in 1)
						// -1, weeks 1
							// not valid, offset changed to 0  (current week in 0)
						// 0 weeks 1,2,3 
						//    0	  (current week in 0)
						//	   weeks, 0,1,2
						// 1 weeks 1 (not valid, current 0)
						//	weeks 0
						//  1 weeks 2 
						//	weeks 0,1  
						// 1 weeks 3
						//    weeks 0,1,2
						// month 
						//   weeks 0,1,2,3
						//$scope[mname].weeks=$scope[mname].weeks.slice(0,weeks_to_view)
						//$scope[mname].weeks=$scope[mname].weeks.reverse()

						let today_weekday=$scope[mname].now.weekday()
	
						let week_position=$scope[mname].days_of_week.indexOf($scope[mname].days_of_week[today_weekday-$scope[mname].first_day_of_week])
						$scope[mname].currentWeek = $scope[mname].week_number_list.indexOf(todays_week_number)

						//console.log("today is a "+today_weekday+" text="+$scope[mname].days_of_week[today_weekday-$scope[mname].first_day_of_week])
						

						// get number of days to fill in calendar cells
						// number of weeks * 7
						// today_week is todays position in current week 
						// week_position is array index 0,1,2,3
						// get count of days prior
						//  today_weekday  + (week_position *7) 0 = only, 1 = second
						//      4 (thurs)  + (week_position *7)  
						// number_of_days = weeks_to_view * 7

						// get the 1st visible day of the calendar (before now usually)
						let first_day = $scope[mname].now.format('D') -((today_weekday  + ($scope[mname].currentWeek*7)-$scope[mname].first_day_of_week)) 

						// start with a copy of today
						let start = $scope[mname].now.clone()
						// start the day object at the 1st visible cal date
						start.set('date', first_day)

						// create the day array
						let number_of_days = weeks_to_view * 7						
						// fill the array
						days=Array(number_of_days).fill({date:start,day:0,events:[],forecast:null})
						for (let i =0; i<number_of_days; i++ ){
							// create an object for each day, will be used by the template
							days[i]={date:moment(start),day:start.format('D'),events:[],forecast:null}
							// add a day
							start.add(1,'day')
						}
						// save the list of days in the scope
						$scope[mname].days=days

						// form the grid column info
						$scope[mname].cell= function(start){
								let x = ""+(parseInt(start)+1)
									if(start !== 6)
										x.concat("/"+(parseInt(start)+2))
								return x
						}
						// form the grid column info
						$scope[mname].cellRow= function(event){
								let starthour=+event.start.format("HH")
								let startmin=+event.start.format("mm")
								let endhour=+event.end.format("HH")
								let endmin=+event.end.format("mm")
								return (starthour*4+Math.ceil(startmin/15))+'/'+(endhour*4+Math.ceil(endmin/15))
						}
						// generate the css classes for this days cell
						$scope[mname].cell_classes=(week,day)=>{
							let d=days[week*7+day]
							let thisMonth=$scope[mname].now.format("MM")===d.date.format("MM")?" thisMonth":""
							let thisYear=$scope[mname].now.format("YYYY")===d.date.format("YYYY")?" thisYear":""
							let isToday=$scope[mname].now.format("YYYYMMDD")===d.date.format("YYYYMMDD")?" today":""
							let passed=$scope[mname].now.isAfter(d.date)?" passed":""
							let celltype = ($scope[mname].timeline || $scope[mname].schedule)?'cellGrid':'cell';
							return celltype +" day"+day+" weekday_"+day+" year_"+d.date.format("YYYY")+" month_"+d.date.format("MM")+ " date_"+d.date.format("DD")+isToday+thisMonth+thisYear+passed
						}
						$scope[mname].calname=(literal)=>{
							return literal.replace('@','_').replace(/\./g,'_')
						}
						updateCalendar($scope[mname].calendar_events)
						if($scope[mname].display_weather_info){
							updateWeather($scope[mname].weatherData)
						}
						resolve()
					})
				}
	})
