// While globals are usually bad news for simplicity the zip code data is stored
// in a global array of javascript objects
// Contains 10 zip codes at most, highest index is oldest (e.g. 9 when full)
var searchResults = [];

// Globals needed by leaflet (map handling)
var map;
var ajaxRequest;
var plotlist;
var plotlayers = [];

// Global used for bus markers and bus line on leaflet map
var shapePolyline;
var busMarkers = {};
var busMarkersStatus = {};

// Global used to save föli route information
var routeIdToShortName = {};
var routeIdColor = {};

// Global used to store which is the currently drawn route on the map
var routeId = "";
var markersRouteShortName = "";

// Globals used to keep track of button disabling timers
var showTimer;
var refreshTimer;
var timeoutEnd;


function initializeMap() {
	// This code is used to initialize the map
	// create leaflet map and center it on the universities in Åbo
	map = new L.Map('map').setView([60.45, 22.28], 10);

	// Add tile layers, attribution and min/max zoom
	var openStreetMap = new L.TileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		minZoom: 8,
		maxZoom: 20,
		attribution: 'Map data <a href="https://www.openstreetmap.org/copyright">&copy</a> <a href="https://openstreetmap.org">OpenStreetMap</a> contributors'
	}).addTo(map);
}

function parseRoutes(routes)	{
	// Add all routes as options for selector
	var lineString = "";

	// First sorts the routes according to the internal route id
	routes.sort(function(a, b)	{
		if (Number(a["route_id"]) < Number(b["route_id"])) {
			return -1;
		}
		if (Number(a["route_id"]) > Number(b["route_id"])) {
			return 1;
		}
		return 0;
	});

	// Goes through routes and adds them as selection options
	for (var i = 0; i < routes.length; i++)	{
		lineString = lineString + '<option value="' + routes[i]["route_id"] + '">' + routes[i]["route_short_name"] + " - " + routes[i]["route_long_name"] + '</option>';

		// Fill out keys, save color information and also dictionary for
		// route IDs to short names
		routeIdToShortName[routes[i]["route_id"]] = routes[i]["route_short_name"];
		busMarkers[routes[i]["route_id"]] = [];
		busMarkersStatus[routes[i]["route_id"]] = -1;
		routeIdColor[routes[i]["route_id"]] = routes[i]["route_color"]
	}

	// Actually adds the html code to the DOM
	$('#select-line').append(lineString);
}

function getCommonShapeId(trips)	{
	// Get the most common shape id
	var shapes = {};
	var max = 0;
	var mostCommonShape = "";

	for (var i = 0; i < trips.length; i++)	{
		// Keep track of how many times a shape id has been referenced by adding
		// 1 to a javascript which has the shape id as a key
		if (shapes[trips[i]["shape_id"]] == undefined)	{
			shapes[trips[i]["shape_id"]] = 1;
		}
		else	{
			shapes[trips[i]["shape_id"]] = shapes[trips[i]["shape_id"]] + 1;
		}

		// If the current key has the most references, indicate that and
		// update the max value
		if (shapes[trips[i]["shape_id"]] > max)	{
			mostCommonShape = trips[i]["shape_id"];
			max = shapes[trips[i]["shape_id"]];
		}
	}
	return mostCommonShape;
}

function getBusPositions(vehicles, routeId)	{
	// Retrieve bus longitude and latitude from provided JSON object
	var coordinates = []
	for (let key in vehicles)	{
		if (vehicles[key]["publishedlinename"] == routeId)	{
			coordinates.push([vehicles[key]["latitude"], vehicles[key]["longitude"]])
		}
	}
	return coordinates;
}

function drawTripShape(routeId, shape)	{
	// Draw a trip using a polyline
	// Uses color defined by the Föli database
	var lineArray = [];

	for (var i = 0; i < shape.length; i++)	{
		lineArray[i] = [shape[i]["lat"], shape[i]["lon"]];
	}
	if (typeof shapePolyline != "undefined")	{
		shapePolyline.removeFrom(map);
	}
	shapePolyline = L.polyline(lineArray, {color: "#" + routeIdColor[routeId], weight: 6}).addTo(map);
}

function drawBusMarkers(routeId, busCoordinates)	{
	// Remove old markers, if any
	for (var i = 0; i < busMarkers[routeId].length; i++)	{
		busMarkers[routeId][i].removeFrom(map);
	}
	// Add new markers to map
	for (var i = 0; i < busCoordinates.length; i++)	{
		busMarkers[routeId][i] = L.marker(busCoordinates[i], {title: routeIdToShortName[routeId]}).addTo(map);
	}
	// Note status (1) that this route has buses drawn
	busMarkersStatus[routeId] = 1;
}
function hideBusMarkers(routeId)	{
	if (busMarkers[routeId] != undefined)	{
		for (var i = 0; i < busMarkers[routeId].length; i++)	{
			busMarkers[routeId][i].removeFrom(map);
		}
	}
	// Note status that this route has hidden markers
	busMarkersStatus[routeId] = 0;
}


$(document).ready(function()	{
// Disable all buttons, could of course have done it in the main html already
$("#show-button").attr("disabled", "disabled");
$("#refresh-button").attr("disabled", "disabled");
$("#route-button").attr("disabled", "disabled");
$("#select-line").removeAttr("disabled");

// Start by requesting routes information
var jqxhrRoutes = $.ajax({
	dataType: "json",
	url: "https://data.foli.fi/gtfs/routes",
});
// Setup callbacks for route information request
jqxhrRoutes.done(function(data, textStatus, jqXHR) {
	var routes = JSON.parse(jqXHR.responseText);
	parseRoutes(routes);

	// Enable buttons and selector
	$("#show-button").removeAttr("disabled");
	$("#route-button").removeAttr("disabled");
	$("#select-line").removeAttr("disabled");
});
jqxhrRoutes.fail(function(jqxhr, textStatus, error) {
	// If the request failed then notify the user
	// We could try again but as for now we will force the user to do a
	// page refresh instead
	$("#error").text("Failed to retrieve basic route data, refresh page").css("color", "#dd5555");

});

// Initialize the map
initializeMap();

$("#route-button").click(function()	{
	// First disable this button
	$("#route-button").attr("disabled", "disabled");

	// If the route was the last one drawn then do nothing 
	if (routeId == $("#select-line").val())	{
		return;
	}

	// Get route id from select option
	var routeId = $("#select-line").val();

	// Setup a request for trips for the given route using the route ID
	var jqxhrTrips = $.ajax({
		//dataType: "json",
		//contentType: "text/plain",
		crossDomain: true,
		url: "https://data.foli.fi/gtfs/trips/route/" + routeId
	});
	// Then setup callbacks to be done onces the request is done
	jqxhrTrips.done(function(dataTrips, textStatusTrips, jqxhrTripsCallback)	{
		// If request successfull, parse response text (not data due to redirect)
		var trips = JSON.parse(jqxhrTrips.responseText);
		// Get a shape ID from the trip data
		var shapeId = getCommonShapeId(trips);

		// Setup a request for a shape using the shape ID
		var jqxhrShapes = $.ajax({
			dataType: "json",
			url: "https://data.foli.fi/gtfs/shapes/" + shapeId
		});
		// Then setup callbacks to be done onces the request is done
		jqxhrShapes.done(function(data, textStatus, jqxhrShapesCallback)	{
			// If request successful, parse response text (not data due to
			// redirect) and draw bus line route
			drawTripShape(routeId, JSON.parse(jqxhrShapesCallback.responseText));
		});
		jqxhrShapes.fail(function(jqxhrShapesCallback, textStatusShapes, errorShapes) {
			// If the request failed, note it to the user
			$("#error").text("Failed to retrieve trip shape data").css("color", "#dd5555");
		});
	});
	jqxhrTrips.fail(function(jqxhrTripsCallback, textStatusTrips, errorTrips) {
		// If the request failed, note it to the user
		$("#error").text("Failed to retrieve trip data").css("color", "#dd5555");
	});

	// Finally re-enabled the button after two seconds
	refreshTimer = setTimeout(function()	{
		$("#route-button").removeAttr("disabled");
	}, 2000);

});

$("#show-button").click(function()	{
	// Disable show button in order to prevent spamming requests
	$("#show-button").attr("disabled", "disabled");

	// Get route id from select option
	var routeId = $("#select-line").val();

	// If we are a remove button, then remove markers and return early
	if ($("#show-button").text() == "Remove buses")	{
		// First disable the refresh button and show button
		$("#refresh-button").attr("disabled", "disabled");
		$("#show-button").attr("disabled", "disabled").text("Show buses");


		// Also disable the refresh timer
		clearTimeout(refreshTimer);

		// Hide the markers
		hideBusMarkers(routeId);

		// Make sure no timeout time is skipped to prevent spamming
		var currentTime = Date.now();
		if (currentTime < timeoutEnd)	{
			showTimer = setTimeout(function()	{
				$("#show-button").removeAttr("disabled");
			}, timeoutEnd - currentTime);
		}
		else	{
			$("#show-button").removeAttr("disabled");
		}

		return;
	}

	// Otherwise continue to request bus positions from Föli and draw them on the map

	// Setup a request for trips for the given route using the route ID
	var jqxhrPositions = $.ajax({
		dataType: "json",
		crossDomain: true,
		url: "https://data.foli.fi/siri/vm"
	});
	// Then setup callbacks to be done onces the request is done
	jqxhrPositions.done(function(dataPositions, textStatusPositions, jqxhrPositionsCallback)	{
		var busPositions

		// If request successfull, check if position data is available
		if (dataPositions["status"] == "OK")	{
			// Parse response text (not data due to redirect) and pick out
			// vehicle coordinates that fit belong to the selected route
			// by identifying them with the line short name
			busPositions = getBusPositions(JSON.parse(jqxhrPositionsCallback.responseText)["result"]["vehicles"], routeIdToShortName[routeId]);

			if (busPositions.length > 0)	{
				// Draw markers for each bus that's active on the line
				drawBusMarkers(routeId, busPositions);
				// Save the name of the route
				//markersRouteShortName = routeShortName;
			}
		}

		// Give an error if there was a problem, otherwise enable refresh
		if (dataPositions["status"] != "OK")	{
			$("#error").text("Monitoring service down").css("color", "#dd5555");
			// Enable the show button after 5 seconds
			timeoutEnd = Date.now() + 5000;
			refreshTimer = setTimeout(function()	{
				$("#show-button").removeAttr("disabled");
			}, 5000);
		}
		else if (busPositions.length == 0)	{
			$("#error").text("No busses found for route").css("color", "#dd5555");

			// Enable the show button after 5 seconds
			timeoutEnd = Date.now() + 5000;
			refreshTimer = setTimeout(function()	{
				$("#show-button").removeAttr("disabled");
			}, 5000);
		}
		else	{
			// Change show button to a hide/remove button, which also means
			// we can enable it
			$("#show-button").text("Remove buses").removeAttr("disabled");

			// Enable the refresh button after 5 seconds
			timeoutEnd = Date.now() + 5000;
			refreshTimer = setTimeout(function()	{
				$("#refresh-button").removeAttr("disabled");
			}, 5000);
		}

	});
	jqxhrPositions.fail(function(jqxhrPositionsCallback, textStatusPositions, errorPositions) {
		// If the request failed, note it to the user
		$("#error").text("Failed to retrieve bus positions").css("color", "#dd5555");

		// Enable the show button again after a 5 seconds
		timeoutEnd = Date.now() + 5000;
		showTimer = setTimeout(function()	{
			$("#show-button").removeAttr("disabled");
		}, 5000);
	});
});

$("#refresh-button").click(function()	{
	// Disable refresh button in order to prevent spamming requests
	$("#refresh-button").attr("disabled", "disabled");

	routeId = $("#select-line").val();

	// Setup a request for trips for the given route using the route ID
	var jqxhrPositions = $.ajax({
		dataType: "json",
		crossDomain: true,
		url: "https://data.foli.fi/siri/vm"
	});
	// Then setup callbacks to be done onces the request is done
	jqxhrPositions.done(function(dataPositions, textStatusPositions, jqxhrPositionsCallback)	{
		// If request successfull, check if position data is available
		if (dataPositions["status"] == "OK")	{
			// Parse response text (not data due to redirect) and pick out
			// vehicle coordinates that fit belong to the selected route
			// by identifying them with the line short name
			var busPositions = getBusPositions(JSON.parse(jqxhrPositionsCallback.responseText)["result"]["vehicles"], routeIdToShortName[routeId]);

			// Draw markers for each bus that's active on the line
			drawBusMarkers(routeId, busPositions);
		}
	});
	jqxhrPositions.fail(function(jqxhrPositionsCallback, textStatusPositions, errorPositions) {
		// If the request failed, note it to the user
		$("#error").text("Failed to update bus positions").css("color", "#dd5555");
	});
	jqxhrPositions.always(function()	{
		// Enable the refresh button after 5 seconds
		timeoutEnd = Date.now() + 5000;
		refreshTimer = setTimeout(function()	{
			$("#refresh-button").removeAttr("disabled");
		}, 5000);
	});
});

$("#select-line").change(function()	{
	// If the user changes which bus route is selected then enable/disable the show
	// and refresh buttons as needed
	// Refresh button is enabled if the selected route is the same as the route the
	// currently drawn bus markers are on
	// Also respect timers in order to prevent request spamming

	if (busMarkersStatus[$("#select-line").val()] == 1)	{
		$("#show-button").text("Remove buses");
		clearTimeout(showTimer);
		clearTimeout(refreshTimer);

		var currentTime = Date.now();
		if (currentTime < timeoutEnd)	{
			refreshTimer = setTimeout(function()	{
				$("#refresh-button").removeAttr("disabled");
			}, timeoutEnd - currentTime);
		}
		else	{
			$("#refresh-button").removeAttr("disabled");
		}
	}
	else	{
		$("#refresh-button").attr("disabled", "disabled");
		$("#show-button").text("Show buses");
		clearTimeout(showTimer);
		clearTimeout(refreshTimer);

		var currentTime = Date.now();
		if (currentTime < timeoutEnd)	{
			showTimer = setTimeout(function()	{
				$("#show-button").removeAttr("disabled");
			}, timeoutEnd - currentTime);
		}
		else	{
			$("#show-button").removeAttr("disabled");
		}
	}

	// Also clear error message if bus line is changed
	$("#error").text("");
});
}); // End of large unindented "$(document).ready(function()" statement
