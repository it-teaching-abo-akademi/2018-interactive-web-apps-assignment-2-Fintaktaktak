// While globals are usually bad news for simplicity the zip code data is stored
// in a global array of javascript objects
// Contains 10 zip codes at most, highest index is oldest (e.g. 9 when full)
var searchResults = [];

// Globals needed by leaflet (map handling)
var map;
var ajaxRequest;
var plotlist;
var plotlayers = [];

// Global used for markers on leaflet map
var markers = [];


function initializeMap() {
	// This code is used to initialize the map
	// create leaflet map and center it on the universities in Åbo
	map = new L.Map('map').setView([60.45, 22.28], 4);

	// Add tile layers, attribution and min/max zoom
	var openStreetMap = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		minZoom: 4,
		maxZoom: 12,
		attribution: 'Map data <a href="https://www.openstreetmap.org/copyright">&copy</a> <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
	}).addTo(map);
}

function updateCookie()	{
	// Create an expiration date that is ~1 month away
	var expirationDate = new Date();
	expirationDate.setTime(expirationDate.getTime() + (31 * 24 * 60 * 60 * 1000));

	// Create the end of the cookie string that contains the expiration date
	var expires = ";expires=" + expirationDate.toUTCString();

	// Create the start of a large cookie "akademiZipSearchData" with a value
	// that will be everything needed by the search history
	// Using "#" mainly as separator, contains "|" where there are arrays inside
	// a single search result (e.g. place names, longitudes and latitudes)
	var largeCookie = "akademiZipSearchData=" + searchResults.length;
	for (var i = 0; i < searchResults.length; i++)	{
		// Add single search result
		largeCookie = largeCookie + "#store" + i;
		largeCookie = largeCookie + "#zipCodes" + i + "=" + searchResults[i]["zip"];
		largeCookie = largeCookie + "#countryNames" + i + "=" + searchResults[i]["country"];
		largeCookie = largeCookie + "#countryAbbreviations" + i + "=" + searchResults[i]["abbreviation"];


		// Add arrays of the search result
		cookiePlaceNames = "";
		cookiePlaceLongitude = "";
		cookiePlaceLatitude = "";

		for (var j = 0; j < searchResults[i]["places"].length; j++)	{
			cookiePlaceNames = cookiePlaceNames + "#placeNames" + i + "|" + j + "=" + searchResults[i]["places"][j];
			cookiePlaceLongitude = cookiePlaceLongitude + "#placeLongitudes" + i + "|" + j + "=" + searchResults[i]["longitudes"][j];
			cookiePlaceLatitude = cookiePlaceLatitude + "#placeLatitudes" + i + "|" + j + "=" + searchResults[i]["latitudes"][j];
		}
		largeCookie = largeCookie + "#places" + i + "|" + searchResults[i]["places"].length;
		largeCookie = largeCookie + cookiePlaceNames;
		largeCookie = largeCookie + cookiePlaceLongitude;
		largeCookie = largeCookie + cookiePlaceLatitude;
	}
	// Set end to cookie string
	largeCookie = largeCookie + "akademiZipSearchEnd" + expires;

	// Save cookie
	document.cookie = largeCookie;
}

function parseCookie()	{
	// Decode cookie
	var cookieInput = decodeURIComponent(document.cookie);

	// Cut down cookie string to only the data that we want
	cookieInput = cookieInput.slice(cookieInput.indexOf("akademiZipSearchData=") + 21, cookieInput.indexOf("akademiZipSearchEnd"));

	// Skip if the cookie doesn't seem to be long enough
	if (cookieInput.length < 30)	{
		return;
	}

	// Retrieve the amount of results stored in the cookie
	var codeCount = cookieInput.match(/[0-9]+/);

	// Regular expressions that will search through the string and add the values
	// to the global variables, one match at a time
	// This is unlikely to be the most efficient way to do it, however it is
	// hopefully readable and also doesn't rely as much on specific string
	// indicies
	// The regular expressions will take one match at a time, when you call it
	// the next time it remembers where it started from (if using /g global)
	var zipCodeSearch = /zipCodes[0-9]+=([^#]*)/g;
	var countryNameSearch = /countryNames[0-9]+=([^#]*)/g;
	var countryAbbreviationSearch = /countryAbbreviations[0-9]+=([^#]*)/g;
	var placeCountSearch = /places[0-9]+\|([0-9]+)/g;
	var placeNameSearch = /placeNames[0-9]+\|[0-9]+=([^#|]*)/g;
	var placeLongitudeSearch = /placeLongitudes[0-9]+\|[0-9]+=([^#|]*)/g;
	var placeLatitudeSearch = /placeLatitudes[0-9]+\|[0-9]+=([^#|]*)/g;


	for (var i = 0; i < codeCount; i++)	{
		// Setup javascript object structure
		searchResults[i] = {
			zip: "",
			country: "",
			abbreviation: "",
			places: [],
			longitudes: [],
			latitudes: []
		}

		// Add cookie values to global search result array
		searchResults[i]["zip"] = zipCodeSearch.exec(cookieInput)[1];
		searchResults[i]["country"] = countryNameSearch.exec(cookieInput)[1];
		searchResults[i]["abbreviation"] = countryAbbreviationSearch.exec(cookieInput)[1];

		placeCount = placeCountSearch.exec(cookieInput)[1];
		for (var j = 0; j < placeCount; j++)	{
			searchResults[i]["places"][j] = placeNameSearch.exec(cookieInput)[1];
			searchResults[i]["longitudes"][j] = placeLongitudeSearch.exec(cookieInput)[1];
			searchResults[i]["latitudes"][j] = placeLatitudeSearch.exec(cookieInput)[1];
		}
	}
}

function parseZipResponse(responseText)	{
	// First parse the text into a javascript object
	var responseObject = JSON.parse(responseText);
//	var responseObject = responseText;
	// Then shift away one of the search results if there already are 10 saved
	if (searchResults.length == 10)	{
		searchResults.shift();
	}
	var currentIndex = searchResults.length;

	// Create the javascript object to my preference for saving critical information
	// Retrieves the information from the recieved response text
	searchResults[currentIndex] = {
		zip: responseObject["post code"],
		country: responseObject["country"],
		abbreviation: responseObject["country abbreviation"],
		places: [],
		longitudes: [],
		latitudes: []
	}

	// Need to add info from the individual places separately
	for (var i = 0; i < responseObject["places"].length; i++)	{
		searchResults[currentIndex]["places"].push(responseObject["places"][i]["place name"]);
		searchResults[currentIndex]["longitudes"].push(responseObject["places"][i]["longitude"]);
		searchResults[currentIndex]["latitudes"].push(responseObject["places"][i]["latitude"]);

		// Some coordinates seems to be incorrect/formated differently on
		// zippotam.us
		// Dresden, 01108 has long: "51.05", latitude: "14612" as an example
		// Latitude and longitude seems to have switched places and latitude
		// value has no dot
		// This doesn't really correct it (because I wasn't going through every
		// single postcode to see if there are other versions as well) but it
		// does make sure that at least this specific type is dealt with
		if (searchResults[currentIndex]["latitudes"][i] > 90)	{
			searchResults[currentIndex]["longitudes"][i] = responseObject["places"][i]["latitude"].slice(0, 2) + "." + responseObject["places"][i]["latitude"].slice(2)
			searchResults[currentIndex]["latitudes"][i] = responseObject["places"][i]["longitude"]
			console.log("Custom fix of some Germany zip codes");
		}
	}
}

function validZip(countryCode, zip)	{
	// Check if the zip code is within a valid range
	// Return "Zip <input> is invalid if not
	// otherwise return the zip code (! leading zeroes added !)

	// These are the requirements for most countries zip codes
	// Though some would need special code to deal with letters dashes or spaces in
	// the zip code, however dealing with them wasn't part of the assignment
	// requirements
	var countryZipCodeLength = 0;
	var countryZipLow = 0;
	var countryZipHigh = 0;

	// Setup the requirements for the specified country
	// In hindsight I should probably have set this up as some key : value dictionary
	// Then I could have populated both the option selector and done the check using
	// it
	switch (countryCode)	{
		case "AR":
			// Argentina
			countryZipCodeLength = 4;
			countryZipLow = 1601;
			countryZipHigh = 9431;
			break;
		case "AS":
			// American Samoa
			countryZipCodeLength = 5;
			countryZipLow = 96799;
			countryZipHigh = 96799;
			break;
		case "AT":
			// Austria
			countryZipCodeLength = 4;
			countryZipLow = 1010;
			countryZipHigh = 9992;
			break;
		case "AU":
			// Australia
			countryZipCodeLength = 4;
			countryZipLow = 0200;
			countryZipHigh = 9726;
			break;
		case "BD":
			// Bangladesh
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9461;
			break;
		case "BE":
			// Belgium
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9992;
			break;
		case "BG":
			// Bulgaria
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9974;
			break;
 		case "CH":
			// Switzerland
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9658;
			break;
		case "DE":
			// Germany
			countryZipCodeLength = 5;
			countryZipLow = 01067;
			countryZipHigh = 99998;
			break;
		case "DK":
			// Denmark
			countryZipCodeLength = 4;
			countryZipLow = 800; // 0800
			countryZipHigh = 9990;
			break;
		case "DO":
			// Dominican Republic
			countryZipCodeLength = 5;
			countryZipLow = 10101;
			countryZipHigh = 11906;
			break;
		case "ES":
			// Spain
			countryZipCodeLength = 5;
			countryZipLow = 01001;
			countryZipHigh = 52080;
			break;
		case "FI":
			// Finland
			countryZipCodeLength = 5;
			countryZipLow = 2;
			countryZipHigh = 99999;
			break;
		case "FO":
			// Faroe Islands
			countryZipCodeLength = 3;
			countryZipLow = 100;
			countryZipHigh = 970;
			break;
		case "FR":
			// France
			countryZipCodeLength = 5;
			countryZipLow = 1000;
			countryZipHigh = 98799;
			break;
		case "GF":
			// French Guyana
			countryZipCodeLength = 5;
			countryZipLow = 97300;
			countryZipHigh = 97300;
			break;
		case "GL":
			// Greenland
			countryZipCodeLength = 4;
			countryZipLow = 2412;
			countryZipHigh = 3992;
			break;
		case "GP":
			// Guadeloupe
			countryZipCodeLength = 5;
			countryZipLow = 97100;
			countryZipHigh = 97190;
			break;
		case "GT":
			// Guatemala
			countryZipCodeLength = 5;
			countryZipLow = 01001;
			countryZipHigh = 22027;
			break;
		case "GU":
			// Guam
			countryZipCodeLength = 5;
			countryZipLow = 96910;
			countryZipHigh = 96932;
			break;
		case "GY":
			// Guyana
			countryZipCodeLength = 5;
			countryZipLow = 97312;
			countryZipHigh = 97360;
			break;
		case "HR":
			// Croatia
			countryZipCodeLength = 5;
			countryZipLow = 10000;
			countryZipHigh = 52396;
			break;
		case "HU":
			// Hungary
			countryZipCodeLength = 4;
			countryZipLow = 1011;
			countryZipHigh = 9985;
			break;
		case "IN":
			// India
			countryZipCodeLength = 6;
			countryZipLow = 110001;
			countryZipHigh = 855126;
			break;
		case "IS":
			// Iceland
			countryZipCodeLength = 3;
			countryZipLow = 101;
			countryZipHigh = 902;
			break;
		case "IT":
			// Italy
			countryZipCodeLength = 5;
			countryZipLow = 00010;
			countryZipHigh = 98168;
			break;
		case "LI":
			// Lichtenstein
			countryZipCodeLength = 4;
			countryZipLow = 9485;
			countryZipHigh = 9498;
			break;
		case "LT":
			// Lithuania
			countryZipCodeLength = 5;
			countryZipLow = 00001;
			countryZipHigh = 99069;
			break;
		case "MC":
			// Monaco
			countryZipCodeLength = 5;
			countryZipLow = 97100;
			countryZipHigh = 97190;
			break;
		case "MH":
			// Marshall Islands
			countryZipCodeLength = 5;
			countryZipLow = 96960;
			countryZipHigh = 96970;
			break;
		case "MK":
			// Macedonia
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 7550;
			break;
		case "MP":
			// Northern Mariana Islands
			countryZipCodeLength = 5;
			countryZipLow = 96950;
			countryZipHigh = 96952;
			break;
		case "MQ":
			// Martinique
			countryZipCodeLength = 5;
			countryZipLow = 97200;
			countryZipHigh = 97290;
			break;
		case "MX":
			// Mexico
			countryZipCodeLength = 5;
			countryZipLow = 01000;
			countryZipHigh = 99998;
			break;
		case "MY":
			// Malaysia
			countryZipCodeLength = 5;
			countryZipLow = 01000;
			countryZipHigh = 98859;
			break;
		case "NL":
			// Holland
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9999;
			break;
		case "NO":
			// Norway
			countryZipCodeLength = 4;
			countryZipLow = 0001;
			countryZipHigh = 9991;
			break;
		case "NZ":
			// New Zealand
			countryZipCodeLength = 4;
			countryZipLow = 0110;
			countryZipHigh = 9893;
			break;
		case "PH":
			// Phillippines
			countryZipCodeLength = 4;
			countryZipLow = 0400;
			countryZipHigh = 9811;
			break;
		case "PK":
			// Pakistan
			countryZipCodeLength = 5;
			countryZipLow = 10010;
			countryZipHigh = 97320;
			break;
		case "PM":
			// Saint Pierre and Miquelon
			countryZipCodeLength = 5;
			countryZipLow = 97500;
			countryZipHigh = 97500;
			break;
		case "PR":
			// Puerto Rico
			countryZipCodeLength = 5;
			countryZipLow = 601; //00601
			countryZipHigh = 988; //00988
			break;
		case "RE":
			// French Reunion
			countryZipCodeLength = 5;
			countryZipLow = 97400;
			countryZipHigh = 97490;
			break;
		case "RU":
			// Russia
			countryZipCodeLength = 6;
			countryZipLow = 101000;
			countryZipHigh = 901993;
			break;
		case "SE":
			// Sweden
			countryZipCodeLength = 5;
			countryZipLow = 10005;
			countryZipHigh = 98499;
			break;
		case "SI":
			// Slovenia
			countryZipCodeLength = 4;
			countryZipLow = 1000;
			countryZipHigh = 9600;
			break;
		case "SJ":
			// Svalbard & Jan Mayen Islands
			countryZipCodeLength = 4;
			countryZipLow = 8099;
			countryZipHigh = 9178;
			break;
		case "SM":
			// San Marino
			countryZipCodeLength = 5;
			countryZipLow = 47890;
			countryZipHigh = 47899;
			break;
		case "TH":
			// Thailand
			countryZipCodeLength = 5;
			countryZipLow = 10100;
			countryZipHigh = 96220;
			break;
		case "TR":
			// Turkey
			countryZipCodeLength = 5;
			countryZipLow = 01000;
			countryZipHigh = 81950;
			break;
		case "US":
			// United States
			countryZipCodeLength = 5;
			countryZipLow = 00210;
			countryZipHigh = 99950;
			break;
		case "VA":
			// Vatican
			countryZipCodeLength = 5;
			countryZipLow = 00120;
			countryZipHigh = 00120;
			break;
		case "VI":
			// Virgin Island
			countryZipCodeLength = 5;
			countryZipLow = 801; //00801
			countryZipHigh = 851; //00851
			break;
		case "YT":
			// Mayotte
			countryZipCodeLength = 5;
			countryZipLow = 97600;
			countryZipHigh = 97680;
			break;
		case "ZA":
			// South Africa
			countryZipCodeLength = 4;
			countryZipLow = 0002;
			countryZipHigh = 9992;
			break;
		default:
			// If it isn't a supported country we will return early here
			// Should be impossible to reach during normal operation as
			// the site uses a dropdown with limited country choices
			return "-1";
	}

	// First add leading zeroes
	if (zip.length < countryZipCodeLength)	{
		zip = "0".repeat(countryZipCodeLength - zip.length) +  zip
	}
	if (zip.length != countryZipCodeLength)	{
		// Incorrect length
		zip = "-1";
	}
	else if (zip.search(/[^0-9]/) != -1)	{
		// Contains something other than numbers
		zip = "-1";
	}
	else if (zip < countryZipLow)	{
		// Outside valid zip code range for the country
		zip = "-1";
	}
	else if (zip > countryZipHigh)	{
		// Outside the valid zip code range for the country
		zip = "-1";
	}

	return zip;
}

function checkZipHistory(countryCode, zip)	{
	// Checks to see if the search term is already stored in results
	// Return true if found, the result will also be shifted to the last position
	// in the storage arrays

	for (var i = 0; i < searchResults.length; i++)	{
		if ((zip == searchResults[i]["zip"]) && (countryCode == searchResults[i]["abbreviation"]))	{
			// Cuts out the object (with splice) and the adds its it back
			// with push at the end
			// Important to access the actual object (hence the [0])
			// otherwise you'd be adding an array containing the object
			// instead of only the object
			searchResults.push(searchResults.splice(i, 1)[0]);

			return true;
		}
	}
	return false;
}

function updateTable()	{
	// Update place table results

	// First check if there are any results yet, otherwise return early
	if (searchResults.length == 0)	{
		return
	}

	// Empty the table columns
	$("#place-name-column").empty()
	$("#place-longitude-column").empty()
	$("#place-latitude-column").empty()

	// Add top row column names as html strings
	var nameAppendString = '<div class="table-content table-top">Place name</div>';
	var longitudeAppendString = '<div class="table-content table-top">Longitude</div>';
	var latitudeAppendString = '<div class="table-content table-top">Latitude</div>';

	// Then fill in results as needed
	var topResultIndex = searchResults.length - 1;

	for (var i = 0; i < searchResults[topResultIndex]["places"].length; i++)	{
		nameAppendString = nameAppendString + '<div class="table-content">' + searchResults[topResultIndex]["places"][i] + '</div>';
		
		longitudeAppendString = longitudeAppendString + '<div class="table-content">' + searchResults[topResultIndex]["longitudes"][i] + '</div>';
		latitudeAppendString = latitudeAppendString +'<div class="table-content">' + searchResults[topResultIndex]["latitudes"][i] + '</div>';
	}

	// Finally actually append the string to the column DOMs
	$('#place-name-column').append(nameAppendString);
	$('#place-longitude-column').append(longitudeAppendString);
	$('#place-latitude-column').append(latitudeAppendString);
}

function updateHistory()	{
	for (var i = 0; i < searchResults.length; i++)	{
		$("#search-history-" + i).text(searchResults[i]["country"] + " - " + searchResults[i]["zip"]);
	}
}

function updateMap()	{
	// Updates markers on the map

	// First check if there actually is any search results to handle
	if (searchResults.length == 0)	{
		return;
	}

	// Clear old markers
	for (var i = 0; i < markers.length; i++)	{
		markers[i].removeFrom(map);
	}

	// Then add markers as needed
	resultIndex = searchResults.length - 1;
	for (var i = 0; i < searchResults[resultIndex]["places"].length; i++)	{
		markers[i] = L.marker([searchResults[resultIndex]["latitudes"][i], searchResults[resultIndex]["longitudes"][i]], {title: searchResults[resultIndex]["places"][i]}).addTo(map);
	}

	// Finally pan to the first new marker
	map.panTo([searchResults[resultIndex]["latitudes"][0], searchResults[resultIndex]["longitudes"][0]]);
}


$(document).ready(function()	{

parseCookie();
updateTable();
updateHistory();
initializeMap();
updateMap();


$("#search-button").click(function()	{
	// Get the selected country code and the given zip code
	var countryCode = $("#select-country").val();
	var zip = $("#input-zip").val();

	// First check that the zip code is within the valid range for the country
	zip = validZip(countryCode, zip);

	// If the zip code was not valid for the selected country, then return early
	if (zip == -1)	{
		// Indicate that the zip value was incorrect
		$("#input-error").text(" Invalid ").css("color", "#dd5555");
		$("#input-zip").css("background-color", "#ffaaaa");

		// return early
		return;
	}
	else	{
		// Clear any indiciations that there would have been an error
		$("#input-zip").val(zip).css("background-color", "#ffffff");
		$("#input-error").text("");
	}

	// Check if the search term is among the last 10 searches done
	if (checkZipHistory(countryCode, zip) == true)	{
		// If it was, then simply update the page accordingly
		// Update cookie for persistent storage of search results
		// In this case it's simply to update the order
		updateCookie();

		// Update history of 10 last searches
		updateHistory();

		// Update result tables
		updateTable();

		// Update map markers
		updateMap();
	}
	else	{
		// If it wasn't, request information from zippotam.us
		// Also disable the search button
		$("#search-button").text("Searching").attr("disabled", "disabled");

		// Then do the actual request
		var jqxhr = $.ajax({
			dataType: "html",
			url: "https://api.zippopotam.us/" + countryCode + "/" + zip
		});
		// Finally setup callback to be done once the page request is done
		jqxhr.done(function(data) {
			parseZipResponse(data);

			// Update cookie for persisten storage of search results
			updateCookie();

			// Update history of 10 last searches
			updateHistory();

			// Update result tables
			updateTable();

			// Update map markers
			updateMap();
		});
		jqxhr.fail(function(jqxhr, textStatus, error) {
			// If the request failed, note it to the user
			if (error = "Not found")	{
				$("#input-error").text(" Doesn't exist").css("color", "#dd5555");
			}
			else	{
				$("#input-error").text(" Search failed ").css("color", "#dd5555");
			}
		});
		jqxhr.always(function() {
			// Always re-enabled search button once a search request is done
			$("#search-button").text("Search").removeAttr("disabled");
		});
	}
});


$("#input-zip").keyup(function(event)	{
	// If the enter key is pressed, then let's also do a search
	// Use "keyup" as event in order to not get quick repeats
	if(event.which == 13)	{
		// Trigger the search button's click function if enter (13) is pressed
		$("#search-button").click();
	}
});

$("#input-zip").focus(function()	{
	$(this).css("background-color", "#ffffff");
	$("#input-error").text("");
});
}); // End of large unindented "$(document).ready(function()" statement