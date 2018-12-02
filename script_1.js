// Function that's called when the page is done loading
function pageLoadDone()	{
	// Attach event handlers to the input
	document.getElementById("virtual-code-input").onfocus = grayInput;
	document.getElementById("virtual-code-input").onblur = whiteInput;
}

function grayInput()	{
	this.select();
	this.style="background-color:hsl(0, 0%, 75%);";
}
function whiteInput()	{
	this.style="background-color:hsl(0, 0%, 100%);";
}

// Specify which function will to call when page is done loading
window.onload = pageLoadDone;



//jQuery scripts
$(document).ready(function(){
$("#decode-button").click(function(){
	// Read the input code
	var virtualCode = $("#virtual-code-input").val();

	// This is what will ultimately be output as code details
	var ibanText = "";
	var amountText = "";
	var referenceText = "";
	var dateText = "";
	var errorText = "";


	// First strip out whitespace
	virtualCode = virtualCode.replace(/ */g,"");

	// Then start basic error checking of the recieved code
	// First check if the input code is potentially the full length bar code
	// version including the Code 128 start, checksum and stop values
	// Also makes sure that the checksum is correct (error otherwise)
	// Once done strips the string down to 54 characters if there was no error
	if ((virtualCode.length == 63) || (virtualCode.length == 64))	{

		if (virtualCode.startsWith("105") && virtualCode.endsWith("stop"))	{
			virtualCode = virtualCode.slice(3, virtualCode.lastIndexOf("stop"));
			var input_check_digit = virtualCode.slice(54, virtualCode.length);

			// Calculate checksum
			var check_digit = 105;
			var coefficient = 1;
			var i = 0;
			for (i = 0; i < 54; i += 2)	{
				check_digit = check_digit + coefficient * virtualCode.slice(i, i + 2);
				coefficient = coefficient + 1;
			}
			check_digit = check_digit % 103;

			if ((input_check_digit - check_digit) != 0)	{
				errorText = "Error: Entered code has incorrect Code 128 checksum";
			}
			else	{
				// Strip it down to only 54 characters if checksum was
				// correct
				virtualCode = virtualCode.slice(0, 54);
			}
		}
		else	{
			errorText = "Error: Entered code has invalid Code 128 start or stop values";
		}

	}

	// Main error cheking code
	if (errorText.length != 0)	{
		// Skip error checking if one was already found
	}
	else if (virtualCode.length != 54)	{
		// Check that the length is correct and that it only contains numbers
		errorText = "Error: Entered code is of invalid length";
	}
	else if (virtualCode.search(/[^0-9]/) != -1)	{
		// Then check that the code only contains numbers
		errorText = "Error: Code must only contain numbers"
	}
	else if ((virtualCode.charAt(0) != 4) && (virtualCode.charAt(0) != 5))	{
		errorText = "Error: Code needs to be of version 4 or 5";
	}
	else if ((virtualCode.charAt(0) == 4) && (virtualCode.slice(25, 28) != "000"))	{
		// If the code version is 4 then there should be a reserve space
		// containing only zeroes
		errorText = "Error: Entered code is not a valid version 4 Bank Bar Code";
	}
	else	{
		// Check that the date is correct
		// Note that the use of a date object is simply done so one doesn't
		// have to attempt to keep track of leap-days etc. when checking
		// if the given date is correct
		// Note also that 000000 is a valid value for YYMMDD (empty)
		// There is also no defined timezone, using UTC for now

		if (virtualCode.slice(48,54) != "000000")	{
			var year = 2000 + Number(virtualCode.slice(48, 50));
			var month = Number(virtualCode.slice(50, 52));
			var day = Number(virtualCode.slice(52, 54));
			var date = new Date()
			date.setUTCFullYear(year);
			// January = 0, thus the subtraction
			date.setUTCMonth(month - 1);
			date.setUTCDate(day);

			// getUTCMonth() returns with January = 0 etc., thus the addition
			if ((date.getDate() != day) || (date.getUTCMonth() + 1 != month) || (date.getFullYear() != year))	{
				errorText = "Error: Entered code has an incorrect payment due date";
			}
			else	{
				// Don't add hours, seconds etc. to string
				dateText = date.toISOString().slice(0, 10);
			}
		}
		else	{
			dateText = "Undefined";
		}
	}


	if (errorText == "")	{
		ibanText = "";
		// Retrieve the payment amount and remove leading zeroes
		// 00000000 is an allowed special case
		// Technically no currency is specified, so no currency symbol is added
		if (virtualCode.slice(21, 29) == "00000000")	{
			amountText = "Undefined";
		}
		else	{
			amountText = virtualCode.slice(17, 23);
			// Note the behaviour of search on strings here, if there
			// are no zeroes it will return "-1", which slice in turn
			// uses to start indexing from the end of the string
			// thus even if there are only zeroes we still get 1 character
			amountText = amountText.slice(amountText.search(/[^0]/));
			amountText = amountText + "," + virtualCode.slice(23, 25);
		}

		// The reference account is handled differently depending on if it is
		// a version 4 or version 5 code
		if (virtualCode.charAt(0) == 4)	{
			// Retrieve reference account and format it properly
			referenceText = virtualCode.slice(28, 33) + " " + virtualCode.slice(33, 38) + " " + virtualCode.slice(38, 43) + " " + virtualCode.slice(43, 48);
			referenceText = referenceText.slice(referenceText.search(/[^0 ]/));
		}
		else	{
			// Retrieve reference account and format it properly
			referenceText = virtualCode.slice(27, 48);
			referenceText = referenceText.slice(referenceText.search(/[^0 ]/));
			// Use a regular expressions with a capturing group in order
			// to insert spaces at appropriate places
			referenceText = referenceText.replace(/([0-9][0-9][0-9][0-9])/g, "$1 ");

			// If the code is a version 5 code then append "RF" and a cheksum number
			referenceText = "RF" + virtualCode.slice(25, 27) + " " + referenceText;
		}

		// Retrieve IBAN account and format it properly	
		ibanText = virtualCode.slice(1, 3) + " " + virtualCode.slice(3, 7) + " " + virtualCode.slice(7, 11) + " " + virtualCode.slice(11, 15) + " " + virtualCode.slice(15, 17);


		// Create barcode
		$("#barcode").JsBarcode(virtualCode, {format:"CODE128C", text:" ", textMargin: 0, margin: 0, fontSize: 0});

	}
	else	{
		// Create an "error" barcode
		// Could simply hide it as well, but this gives the error nice visibilty
		$("#barcode").JsBarcode(virtualCode, {format:"CODE128", text: errorText, margin: 0, lineColor: "#990000"});
	}

	// Finally add payment details or an error message
	$("#payment-iban").text(ibanText);
	$("#payment-amount").text(amountText);
	$("#payment-reference").text(referenceText);
	$("#payment-date").text(dateText);
});


$("#hide-button").click(function(){
	var buttonState = $("#hide-button").text();

	if (buttonState == "Show")	{
		$("#information").slideDown("slow", function()	{
			$("#hide-button").text("Hide").removeAttr("disabled");
		});
		$("#hide-button").text("").attr("disabled", "disabled");
	}
	else if (buttonState == "Hide")	{
		$("#information").slideUp("slow", function()	{
			$("#hide-button").text("Show").removeAttr("disabled");
		});
		$("#hide-button").text("").attr("disabled", "disabled");
	}
});

$("#virtual-code-input").keyup(function(event)	{
	// If the enter key is pressed, then let's also attempt to create the barcode
	// Use "keyup" as event in order to not get quick repeats
	if(event.which == 13)	{
		// Trigger the decode button's click function if enter (13) is pressed
		$("#decode-button").click();
	}
});

/* This would be an alternative way to handle the graying of the input box
$("#virtual-code-input").blur(function()	{
	$(this).css("background-color", "hsl(0, 0%, 100%)");
});
$("#virtual-code-input").focus(function()	{
	$(this).css("background-color", "hsl(0, 0%, 75%)");
});
*/
});