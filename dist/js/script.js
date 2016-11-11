/* Author: Amelia McNamara
*/

$('.tooltip-test').tooltip()
$('#collapseOne').collapse("hide");
$('#repo').repo({ user: 'AmeliaMN', name: 'SoCDataViz' });
$('.more').click(function(){
    	$(this).text(function(i,old){
        	return old=='read less' ?  'read more' : 'read less';
    	});
    	$(this).blur();
});
$('.code').click(function(){
    	$(this).text(function(i,old){
        	return old=='hide code' ?  'view code' : 'hide code';
    	});
    	$(this).blur();
});




















