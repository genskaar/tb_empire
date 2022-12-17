/* Custom directive for detecting click outside of element */
/*Vue.directive('click-outside', {
	bind: function (el, binding, vnode) {
		this.event = function (event) {
		if (!(el == event.target || el.contains(event.target))) {
			vnode.context[binding.expression](event);
		}
	};
	document.body.addEventListener('click', this.event)
	},
	unbind: function (el) {
		document.body.removeEventListener('click', this.event)
	},
});
	*/
Vue.component('mission', {
	data: function () {
		return {
		isMobile: false,
		squads: [
		//---------------------------------------------------------------------------------------------------------------------------------DS SQUADS
			{	
				id: 0,
				name: 'Sith Empire',
				toons: ['darth_revan', 'bastila_shan_(fallen)', 'hk-47', 'sith_marauder', 'darth_malak']
			},
			{
				id: 1,
				name: 'First Order',
				toons: ['kylo_ren_(unmasked)', 'kylo_ren', 'first_order_executioner', 'first_order_officer', 'first_order_stormtrooper'],
			},
			{
				id: 2,
				name: 'Bounty Hunters',
				toons: ['bossk','jango_fett', 'boba_fett', 'dengar', 'cad_bane']
			},
			{
				id: 3,
				name: 'Empire',
				toons: ['emperor_palpatine', 'darth_vader', 'grand_admiral_thrawn', 'grand_moff_tarkin', 'tie_fighter_pilot'  ]
			},
			{
				id: 4,
				name: 'Night Sisters',
				toons: ['mother_talzin', 'asajj_ventress', 'nightsister_zombie', 'old_daka', 'nightsister_spirit' ]
			},
			{
				id: 5,
				name: 'Sith Triumvirate',
				toons: ['darth_traya', 'darth_sion', 'darth_nihilus', 'sith_empire_trooper', 'count_dooku']
			},
			{
				id: 6,
				name: 'Separatist Droids',
				toons: ['general_grievous', 'b2_super_battle_droid', 'b1_battle_droid', 'droideka', 'ig100_magnaguard']
			},
			{
				id: 7,
				name: 'Geonosians',
				toons: ['geonosian_brood_alpha', 'geonosian_soldier', 'geonosian_spy', 'poggle_the_lesser', 'sun_fac']
			},
			{
				id: 8,
				name: 'Nute team',
				toons: ['nute_gunrey', 'b1_battle_droid', 'b2_super_battle_droid', 'droideka', 'ig100_magnaguard' ]
			},
			{
				id: 9,
				name: 'Dooku + Asajj',
				toons: ['count_dooku', 'asajj_ventress']
			},
			{
				id: 10,
				name: 'Poggle Geos',
				toons: ['poggle_the_lesser', 'geonosian_soldier', 'geonosian_spy', 'sun_fac', 'geonosian_brood_alpha']
			},
			{
				id: 11,
				name: 'Chimaera standard',
				toons: ['hound\'s_tooth', 'imperial_tie_fighter', 'tie_silencer', 'xanadu_blood', 'emperor\'s_shuttle']
			},
			{
				id: 12,
				name: 'Executrix standard',
				toons: ['sun_fac\'s_geonosian_starfighter', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'gauntlet_starfighter', 'slave_i' ]
			},
			{
				id: 13,
				name: 'Chimaera bugs (without Hound\'s Tooth)',
				toons: ['sun_fac\'s_geonosian_starfighter', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'gauntlet_starfighter', 'slave_i']
			},
			{
				id: 14,
				name: 'Nightsisters without Asajj',
				toons: ['mother_talzin',  'nightsister_zombie', 'old_daka', 'nightsister_spirit', 'talia' ]
			},
			{
				id: 15,
				name: 'Sith Triumvirate without Dooku',
				toons: ['darth_traya', 'darth_sion', 'darth_nihilus', 'sith_empire_trooper', 'sith_assassin']
			},
			{
				id: 16,
				name: 'Test squad',
				toons: ['count_dooku', 'general_grievous', 'b2_super_battle_droid', 'nute_gunrey', 'b1_battle_droid']
			},
			{
				id: 17,
				name: 'Executrix without Hound\'s Tooth',
				toons: ['b-28_extinction-class_bomber', 'emperor\'s_shuttle', 'sith_fighter', 'tie_advanced_x1', 'xanadu_blood']
			},
			{
				id: 18,
				name: 'Chimaera with Hound\'s Tooth and bugs',
				toons: ['hound\'s_tooth', 'geonosian_spy_starfighter', 'geonosian_soldier\'s_starfighter', 'sun_fac\'s_geonosian_starfighter', 'gauntlet_starfighter', 'slave_i']
			},
			
			//---------------------------------------------------------------------------------------------------------------------------------LS SQUADS
			{
				id: 19, 
				name: 'LS test squad',
				toons: ['ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)','ahsoka_tano_(fulcrum)',] //hands down best character
			},
			{
				id: 20, //Use once points are updated
				name: 'LS test squad',
				toons: ['ahsoka_tano','ahsoka_tano','ahsoka_tano','ahsoka_tano','ahsoka_tano',] 
			},
			{
				id: 21, 
				name: 'Required: GAS and Snips (21k+ Power)',
				toons: ['general_skywalker','ahsoka_tano','noone','noone','noone'] 
			},
			{
				id: 22, 
				name: 'Required: Kenobi and Clones (21k+ Power)',
				toons: ['general_kenobi','cc-2224__cody_', 'clone_sergeant_-_phase_i','noone','noone'] 
			},
			{
				id: 23,
				name: 'Shaak-ti and Clones (22k+ Power)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-5555__fives_', 'ct-7567__rex_']
				
			},
			{
				id: 24,
				name: 'Unknown',
				toons: ['unknown', 'unknown','unknown','unknown','unknown',]
				
			},
			{
				id:25,
				name: 'Required: Galactic Republic Jedi (23k+ Power)',
				toons: ['ki-adi-mundi', 'shaak_ti', 'gl_kenobi', 'mace_windu', 'aayla_secura',]
             },			
             {
                id:26,
                name: 'Kenobi Negotiator Fleet w/o Y-Wing',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter','ahsoka_tano\'s_jedi_starfighter', 'umbaran_starfighter', 'plo_koon\'s_jedi_starfighter', 'clone_sergeant\'s_arc-170', 'rex\'s_arc-170', 'jedi_consular\'s_starfighter']
             },
             {
                id:27,
                name: 'Home One Fleet',
                toons: ['han\'s_millennium_falcon'],
             },
              {
                id:28,
                name: 'Padme Republic  (Required: Padme and Galactic Republic )',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id:29,
				name: 'Jedi Training Rey',
				toons: ['rey_(jedi_training)', 'c-3po', 'r2-d2', 'finn', 'bb-8'],
				 
			 },
			 {
				id:30,
				name: 'JKR Jedi (Required: Jedi)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
                id:31,
                name: 'Kenobi Negotiator Fleet w/ Y-Wing',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter','ahsoka_tano\'s_jedi_starfighter', 'umbaran_starfighter', 'plo_koon\'s_jedi_starfighter', 'clone_sergeant\'s_arc-170', 'rex\'s_arc-170', 'BTL-B_Y-wing_Starfighter']
             },
             {
                id:32,
                name: 'Kenobi Negotiator Fleet - CS start (see video)',
                toons: ['negotiator', 'anakin\'s_eta-2_starfighter', 'clone_sergeant\'s_arc-170', 'umbaran_starfighter','ahsoka_tano\'s_jedi_starfighter', 'plo_koon\'s_jedi_starfighter', 'rex\'s_arc-170', 'jedi_consular\'s_starfighter']
             },
             {
				id:33,
				name: 'JKL Lead (Required: Jedi)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id: 34,
				name: 'Shaak-ti Lead Clones',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			},
			{
				id: 35,
				name: 'GAS Lead Clones',
				toons: ['general_skywalker', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			},
			{
                id:36,
                name: 'Padme Republic  (Required: Galactic Republic)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
                id:37,
                name: 'Padme Republic' ,
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id: 38,
				name: 'Required: Galactic Republic Jedi, 22k+ Power',
				toons: ['general_kenobi', 'jedi_knight_anakin','grand_master_yoda','ahsoka_tano','barriss_offee',]
				
			},
			{
				id: 39,
				name: 'Unknown (Required: Jedi, 23k+ Power)',
				toons: ['unknown', 'unknown','unknown','unknown','unknown',]
				
			},
			{
				id: 40,
				name: 'Required: GAS & 501st, 23k+ Power',
				toons: ['general_skywalker', 'ct-21-0408__echo_','ct-7567__rex_','arc_trooper','ct-5555__fives_',]
				
			},
			{
				id: 41,
				name: 'Required: Galactic Republic, Padme, JKA, GK, 23k+ Power',
				toons: ['padmé_amidala', 'jedi_knight_anakin','general_kenobi','commander_ahsoka_tano','gl_kenobi',]
				
			},
			{
				id: 42,
				name: 'Resistance (GL Rey or oFinn Lead) (variants available)',
				toons: ['gl_rey', 'resistance_hero_finn','resistance_hero_poe','amilyn_holdo','rey_(jedi_training)',]
				
			},
			 {
				id:43,
				name: 'JKR Jedi with GAS (Required: Jedi)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'general_skywalker', 'grand_master_yoda'],
				 
			 },
			 {
				id:44,
				name: 'Rebels (Either CLS or oROLO Lead)',
				toons: ['commander_luke_skywalker', 'chewbacca', 'han_solo', 'threepio_&_chewie', 'c-3po'],
				 
			 },
			 {
				id:45,
				name: 'Rebel Fighters',
				toons: ['mon_mothma', 'pao', 'hoth_rebel_scout', 'cara_dune', 'kyle_katarn_o'],
				 
			 },
			 {
				 id:46,
				 name: 'Galactic Legend Luke (Required: Jedi) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				 id:47,
				 name: 'Galactic Legend Luke (Required: Jedi, 23k+ Power) (variants available)',
				 toons: ['jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				 id:48,
				 name: 'Galactic Legend Luke (Required: Jedi) (variants available)',
				 toons: ['jedi_knight_luke_skywalker','gl_luke', 'hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
                id:49,
                name: 'Padme Republic Without Snips (Required: Galactic Republic)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'barriss_offee'],
             },
             {
				id: 50,
				name: 'Shaak-ti Lead Clones (Required: Galactic Republic)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
			 {
				id: 51,
				name: 'Home One Rebel Fleet',
				toons: ['home_one', 'han\'s_millennium_falcon', 'biggs_darklighter\'s_x-wing', 'bistan\'s_u-wing', 'rebel_y-wing', 'phantom_ii', 'cassian\'s_u-wing','ghost']
				
		 	 },
		 	 {
				id: 52,
				name: 'Raddus Resistance Fleet',
				toons: ['raddus','poe_dameron\'s_x-wing','rey\'s_millennium_falcon', 'biggs_darklighter\'s_x-wing', 'han\'s_millennium_falcon', 'ebon_hawk', "lando\'s_millennium_falcon","resistance_x-wing"]
				
		 	 },
             {
                id:53,
                name: 'Padme Republic (Required: Padme, Galactic Republic 16.5k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','c-3po', 'ahsoka_tano'],
             },
             {
				id: 54,
				name: 'Shaak-ti Lead Clones (Required: Galactic Republic, 21k+ Power)',
				toons: ['shaak_ti', 'arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
             {
                id:55,
                name: 'Padme Republic Without Snips (Required: Galactic Republic, 21k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             },
             {
				 id:56,
				 name: 'Galactic Legend Luke (Required: Jedi, 21k+ Power) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				id:57,
				name: 'JKL Lead (Required: Jedi, 21k+ Power)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id:58,
				name: 'JKR Jedi (Required: Jedi, 21k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
				 id:59,
				 name: 'Galactic Legend Luke (Required: Jedi, 22k+ Power) (variants available)',
				 toons: [ 'jedi_knight_luke_skywalker','gl_luke','hermit_yoda','jolee_bindo','jedi_knight_revan',],
			 },
			 {
				id:60,
				name: 'JKL Lead (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_luke_skywalker', 'hermit_yoda', 'obi-wan_kenobi_(old_ben)', 'grand_master_yoda', 'aayla_secura'],
			 },
			 {
				id:61,
				name: 'JKR Jedi (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'hermit_yoda', 'grand_master_yoda'],
				 
			 },
			 {
				id:62,
				name: 'JKR Jedi with GAS (Required: Jedi, 22k+ Power)',
				toons: ['jedi_knight_revan', 'bastila_shan', 'jolee_bindo', 'general_skywalker', 'grand_master_yoda'],
				 
			 },
			 {
                id:63,
                name: 'Padme Republic With CAT (Required: Padme, Galactic Republic 16.5k+ Power)',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             },
             {
				id: 64,
				name: 'Required: Galactic Republic, Padme, JKA, GK, 23k+ Power',
				toons: ['padmé_amidala', 'jedi_knight_anakin','general_kenobi','ahsoka_tano','commander_ahsoka_tano',]
				
  			 },
			 {
				id: 65,
				name: 'Galactic Legend Kenobi (Required: Jedi) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','ahsoka_tano','aayla_secura','mace_windu',]
				
			 },
			 {
				id: 66,
				name: 'Galactic Legend Kenobi (Required: Jedi, 21k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_kenobi','grand_master_yoda','aayla_secura','mace_windu',]
				
			 },
             {
				id: 67,
				name: 'Galactic Legend Kenobi (Required: Jedi, 22k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','aayla_secura','general_kenobi','ahsoka_tano',]
				
			 },
			 {
				id: 68,
				name: 'Galactic Legend Kenobi (Required: GR Jedi, 22k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'general_skywalker','aayla_secura','mace_windu','ahsoka_tano',]
				
			 },
			 {
				id: 69,
				name: 'Galactic Legend Kenobi (Required: GR, 21k+ Power) (Variants Available)',
				toons: ['gl_kenobi', 'mace_windu','commander_ahsoka_tano','aayla_secura','padmé_amidala',]
				
			 },
			 {
				id: 70,
				name: 'Bad Batch (22k+ Power)',
				toons: ['hunter', 'echo','wrecker','tech','omega',]
				
			 },
			 {
				id: 71,
				name: 'Padme 501st (Required Padme, Galactic Republic 16.5k+ Power )',
				toons: ['padmé_amidala','arc_trooper', 'ct-21-0408__echo_', 'ct-7567__rex_', 'ct-5555__fives_']
				
			 },
             {
                id:72,
                name: 'Padme Republic',
                toons: ['padmé_amidala','jedi_knight_anakin','general_kenobi','commander_ahsoka_tano', 'r2-d2'],
             }
             



		],
		enemies: [
		'B2 Rocket Droid',//0
		'Command Battle Droid',//1
	    'Count Dooku', //2
	    'General Grevious',//3
	    'General Kalani',//4
	    'Geonosian Brood Alpha', //5
	    'Jango Fett',//6
	    'Nute Gunray', //7	
	    'Poggle the Lesser',//8
	    'Reek',//9
	    'T-Series Tactical Droid',//10
	    'Wat Tambor', //11 
	    'Executrix',//12
	    'Malevolence',//13
	    'Chimaera',//14        
	    'Nexu',//15 
	    'Hound\'s Tooth',//16									
		],
		platoons: [
		["Han's Millennium Falcon", '7', 'Ebon Hawk', '6', 'BTL-B Y-wing', '6', 'Vulture Droid', '5', "Plo Koon's Jedi Starfighter", '5', "Wedge Antilles's X-wing", '5', 'CT-7567 "Rex"\'s ARC-170', '5', 'Hyena Bomber', '4', "Emperor's Command Shuttle", '4', "Biggs Darklighter's X-wing", '4', "Ahsoka Tano's Jedi Starfighter", '3', "Geonosian Spy's Starfighter", '3', "Cassian's U-wing", '3', 'Gauntlet Starfighter', '3', 'Phantom II', '3', "Poe Dameron's X-wing", '3', 'TIE Silencer', '2', "Jedi Consular's Starfighter", '2', 'Scimitar', '2', "Bistan's U-wing", '2', 'Xanadu Blood', '2', 'Umbaran Starfighter', '2', 'First Order TIE FIghter', '1', 'TIE Reaper', '1', 'TIE Advanced x1', '1', "Lando's Millennium Falcon", '1', "Sun Fac's Starfighter", '1', 'IG-2000', '1', "Rey's Millennium Falcon", '1', 'Ghost', '1', "Kylo's Command Shuttle", '1'
],//0
        ['C-3PO', '7', 'R2-D2', '5', 'Finn', '5', 'Hera Syndulla', '4', 'Garazeb "Zeb" Orrelios', '4', 'Biggs Darklighter', '4', 'Visas Marr', '4', 'Barriss Offee', '3', 'Sabine Wren', '3', 'Amilyn Holdo', '3', 'Hermit Yoda', '3', 'Ahsoka Tano', '3', 'Commander Luke Skywalker', '3', 'BB-8', '2', 'Chirrut Îmwe', '2', 'General Kenobi', '2', 'Rose Tico', '2', 'Coruscant Underworld Police', '2', 'Stormtrooper Han', '2', 'Resistance Trooper', '2', 'Resistance Pilot', '2', 'Rey (Scavenger)', '2', 'Enfys Nest', '2', 'Shaak Ti', '2', 'L3-37', '2', 'Luminara Unduli', '2', 'Princess Leia', '2', 'Rey (Jedi Training)', '2', 'Pao', '1', 'Ahsoka Tano (Fulcrum)', '1', 'Baze Malbus', '1', 'Chewbacca', '1', 'CT-7567 "Rex"', '1', 'Jawa Scavenger', '1', 'CC-2224 "Cody"', '1', 'Echo', '1', 'Ugnaught', '1'
],//1
        ['BB-8', '7', 'Commander Luke Skywalker', '5', 'Visas Marr', '4', 'Biggs Darklighter', '4', 'Ahsoka Tano (Fulcrum)', '4', 'Princess Leia', '4', 'R2-D2', '4', 'Garazeb "Zeb" Orrelios', '4', 'Shaak Ti', '4', 'Admiral Ackbar', '3', 'C-3PO', '3', 'Finn', '3', 'Hermit Yoda', '3', 'Baze Malbus', '2', 'Rey (Jedi Training)', '2', 'L3-37', '2', 'Lobot', '2', 'General Kenobi', '2', 'Enfys Nest', '2', 'Ahsoka Tano', '2', 'Barriss Offee', '2', 'Amilyn Holdo', '2', 'Coruscant Underworld Police', '2', 'Stormtrooper Han', '2', 'Resistance Trooper', '2', 'Resistance Pilot', '2', 'Rose Tico', '2', 'Luminara Unduli', '2', 'Ugnaught', '1', 'Jawa', '1', 'Hoth Rebel Soldier', '1', 'Hera Syndulla', '1', 'Hoth Rebel Scout', '1', 'CT-7567 "Rex"', '1', 'Rey (Scavenger)', '1', 'Chewbacca', '1'
],//2
        ["Han's Millennium Falcon", '7', 'Ebon Hawk', '6', 'BTL-B Y-wing', '6', 'Vulture Droid', '5', "Plo Koon's Jedi Starfighter", '5', "Wedge Antilles's X-wing", '5', 'CT-7567 "Rex"\'s ARC-170', '5', 'Hyena Bomber', '4', "Emperor's Command Shuttle", '4', "Biggs Darklighter's X-wing", '4', "Ahsoka Tano's Jedi Starfighter", '3', "Cassian's U-wing", '3', 'Gauntlet Starfighter', '3', 'Phantom II', '3', "Poe Dameron's X-wing", '3', 'TIE Silencer', '2', "Jedi Consular's Starfighter", '2', 'Scimitar', '2', "Geonosian Spy's Starfighter", '2', "Bistan's U-wing", '2', 'Xanadu Blood', '2', 'Umbaran Starfighter', '2', 'First Order TIE FIghter', '1', 'TIE Reaper', '1', 'TIE Advanced x1', '1', "Lando's Millennium Falcon", '1', "Geonosian Soldier's Starfighter", '1', "Sun Fac's Starfighter", '1', 'IG-2000', '1', "Rey's Millennium Falcon", '1', 'Ghost', '1', "Kylo's Command Shuttle", '1'
],//3
        ['Shaak Ti', '6', 'Rebel Officer Leia Organa', '6', 'Commander Luke Skywalker', '6', 'Rey (Jedi Training)', '5', 'Jedi Knight Revan', '5', 'C-3PO', '5', 'Rose Tico', '4', 'BB-8', '4', 'Finn', '4', 'Ima-Gun Di', '3', 'CT-7567 "Rex"', '3', 'Barriss Offee', '3', 'Amilyn Holdo', '3', 'Resistance Trooper', '3', 'Enfys Nest', '2', 'Paploo', '2', "Qi'ra", '2', 'Baze Malbus', '2', 'Ezra Bridger', '2', 'Rey (Scavenger)', '2', 'Stormtrooper Han', '2', 'Admiral Ackbar', '1', 'Zaalbar', '1', 'Sabine Wren', '1', 'Hoth Rebel Scout', '1', 'Wicket', '1', 'Han Solo', '1', 'Visas Marr', '1', 'Coruscant Underworld Police', '1', 'Captain Han Solo', '1', 'Pao', '1', 'Juhani', '1', 'Hoth Rebel Soldier', '1', 'Mission Vao', '1', 'Resistance Pilot', '1', 'Ugnaught', '1', 'Grand Master Yoda', '1'
],//4
        ['Amilyn Holdo', '9', 'Shaak Ti', '7', 'R2-D2', '6', 'Rebel Officer Leia Organa', '6', 'CT-7567 "Rex"', '5', 'Commander Luke Skywalker', '5', 'Barriss Offee', '4', 'Finn', '4', 'Rey (Scavenger)', '4', 'Ima-Gun Di', '3', 'Rose Tico', '3', 'Stormtrooper Han', '3', 'Pao', '2', 'Princess Leia', '2', 'Logray', '2', 'Wicket', '2', 'BB-8', '2', 'Zaalbar', '2', 'Hoth Rebel Soldier', '2', 'Grand Master Yoda', '2', 'Sabine Wren', '1', 'Lobot', '1', 'Juhani', '1', 'Biggs Darklighter', '1', 'Resistance Pilot', '1', 'Garazeb "Zeb" Orrelios', '1', 'Resistance Trooper', '1', 'Han Solo', '1', 'Jawa Scavenger', '1', 'Jawa', '1', 'Ugnaught', '1', 'L3-37', '1', 'Enfys Nest', '1', 'C-3PO', '1', 'Rey (Jedi Training)', '1'
],//5
        ['BTL-B Y-wing', '10', "Han's Millennium Falcon", '10', 'Vulture Droid', '8', "Anakin's Jedi Starfighter", '6', "Emperor's Shuttle", '6', 'Ebon Hawk', '5', 'Gauntlet Starfighter', '4', "Wedge Antilles's X-wing", '4', 'Hyena Bomber', '4', "Biggs Darklighter's X-wing", '4', 'Xanadu Blood', '3', 'IG-2000', '3', 'CT-7567 "Rex"\'s ARC-170', '2', "Plo Koon's Jedi Starfighter", '2', 'TIE Advanced x1', '2', "Poe Dameron's X-wing", '2', "Bistan's U-wing", '2', "Jedi Consular's Starfighter", '2', "Rey's Millennium Falcon", '2', 'First Order TIE FIghter', '1', "Cassian's U-wing", '1', 'Scimitar', '1', "Ahsoka Tano's Jedi Starfighter", '1', "Lando's Millennium Falcon", '1', "Kylo's Command Shuttle", '1', 'Sith Fighter', '1', 'B-28 Extinction-class Bomber', '1', 'Umbaran Starfighter', '1'
],//6
        ['BB-8', '7', 'Jedi Knight Revan', '7', 'Commander Luke Skywalker', '6', 'R2-D2', '5', 'C-3PO', '5', 'Barriss Offee', '4', 'General Skywalker', '4', 'Amilyn Holdo', '3', 'Chewbacca', '3', 'Zaalbar', '3', 'Finn', '3', 'Hermit Yoda', '3', 'Biggs Darklighter', '2', 'Coruscant Underworld Police', '2', 'Mission Vao', '2', 'Princess Leia', '2', 'Pao', '2', 'Rebel Officer Leia Organa', '2', 'Rose Tico', '2', 'Bastila Shan (Light)', '2', 'Resistance Pilot', '2', 'Ezra Bridger', '2', 'Visas Marr', '2', 'Ahsoka Tano (Fulcrum)', '1', 'Padmé Amidala', '1', 'Ima-Gun Di', '1', 'Admiral Ackbar', '1', 'Enfys Nest', '1', 'Captain Han Solo', '1', 'Luminara Unduli', '1', 'Wicket', '1', 'Stormtrooper Han', '1', 'Han Solo', '1', 'Hera Syndulla', '1', 'Sabine Wren', '1', 'Resistance Trooper', '1', 'Rey (Scavenger)', '1', 'Rey (Jedi Training)', '1'
],//7
        ['Hermit Yoda', '7', 'General Skywalker', '6', 'Rey (Scavenger)', '6', 'Rose Tico', '6', 'Grand Master Yoda', '5', 'Enfys Nest', '5', 'C-3PO', '5', 'Rey (Jedi Training)', '5', 'Jedi Knight Revan', '3', 'Padmé Amidala', '3', 'Admiral Ackbar', '3', 'Commander Luke Skywalker', '3', 'Jawa Scavenger', '3', 'Ugnaught', '3', 'Hera Syndulla', '2', 'Princess Leia', '2', 'Resistance Pilot', '2', 'Stormtrooper Han', '2', 'Garazeb "Zeb" Orrelios', '2', 'Ezra Bridger', '2', 'Jawa', '2', 'Lobot', '1', 'Coruscant Underworld Police', '1', 'Ima-Gun Di', '1', 'Amilyn Holdo', '1', 'R2-D2', '1', 'Han Solo', '1', 'General Kenobi', '1', 'Resistance Trooper', '1', "Qi'ra", '1', 'Sabine Wren', '1', 'Hoth Rebel Scout', '1', 'Hoth Rebel Soldier', '1', 'Chirrut Îmwe', '1'
],//8
        ["Han's Millennium Falcon", '14', 'Hyena Bomber', '10', 'BTL-B Y-wing', '9', 'Vulture Droid', '7', "Rey's Millennium Falcon", '5', 'Xanadu Blood', '5', "Ahsoka Tano's Jedi Starfighter", '3', "Wedge Antilles's X-wing", '3', "Biggs Darklighter's X-wing", '3', "Plo Koon's Jedi Starfighter", '2', "Jedi Consular's Starfighter", '2', 'TIE Reaper', '2', 'TIE Advanced x1', '2', 'Ebon Hawk', '2', 'Umbaran Starfighter', '2', 'TIE Silencer', '2', "Lando's Millennium Falcon", '2', "Emperor's Shuttle", '2', 'Gauntlet Starfighter', '2', 'IG-2000', '2', "Bistan's U-wing", '1', 'First Order TIE FIghter', '1', "Geonosian Spy's Starfighter", '1', "Geonosian Soldier's Starfighter", '1', "Sun Fac's Starfighter", '1', 'B-28 Extinction-class Bomber', '1', 'Sith Fighter', '1', 'Scimitar', '1', "Kylo's Command Shuttle", '1'
],//9
        ['Jedi Knight Revan', '9', 'Commander Luke Skywalker', '9', 'Grand Master Yoda', '7', 'Rey (Jedi Training)', '6', 'Baze Malbus', '5', 'Han Solo', '5', 'Rose Tico', '5', 'Enfys Nest', '5', 'Wicket', '4', 'Amilyn Holdo', '4', 'Biggs Darklighter', '3', 'Hermit Yoda', '3', 'Paploo', '2', 'Stormtrooper Han', '2', 'Mission Vao', '2', 'Pao', '2', 'Chewbacca', '2', 'Ahsoka Tano (Fulcrum)', '2', 'Visas Marr', '2', 'Garazeb "Zeb" Orrelios', '2', 'Bastila Shan (Light)', '2', 'Coruscant Underworld Police', '1', 'Resistance Trooper', '1', 'Sabine Wren', '1', 'Ezra Bridger', '1', 'Hoth Rebel Scout', '1', 'Ugnaught', '1', 'L3-37', '1'
],//10
        ['Grand Master Yoda', '9', 'Enfys Nest', '8', 'Jedi Knight Revan', '7', 'Commander Luke Skywalker', '7', 'Rey (Jedi Training)', '6', 'Hermit Yoda', '5', 'Pao', '5', 'Chewbacca', '4', 'L3-37', '4', 'Hoth Rebel Soldier', '3', 'Princess Leia', '3', 'Ahsoka Tano (Fulcrum)', '2', 'Resistance Pilot', '2', 'Han Solo', '2', 'Garazeb "Zeb" Orrelios', '2', 'Lobot', '2', 'Bastila Shan (Light)', '2', 'Jawa Scavenger', '2', 'Amilyn Holdo', '2', 'Rose Tico', '2', 'Baze Malbus', '1', 'Logray', '1', 'Resistance Trooper', '1', 'Mission Vao', '1', 'Admiral Ackbar', '1', 'Ima-Gun Di', '1', 'Jawa', '1', 'Juhani', '1', 'Rey (Scavenger)', '1', 'Ugnaught', '1', 'Visas Marr', '1'
],//11
        ['Ahsoka Tano (Fulcrum) 100'], //test platoon 12
        ['Ahsoka Tano  100'], //test platoon 13
		],
		guides:[
		'See also: 50 Shards of Kam Discord Server',
		'Its Just Ian Modding and Strategy: www.youtube.com/watch?v=9eLKxWumn_Y',
		'McMole2 Defeat the Reek: www.youtube.com/watch?v=ktfNTjiUiGY',
		'Mikayas Sky & Ahsoka guide www.youtube.com/watch?v=rWu4qahiA-g',
		'BitDynasty GAS + Ahsoka guide: www.youtube.com/watch?v=mV7PPNRL2Nc',
		'Z-Gaming JTR with C3P0: www.youtube.com/watch?v=rOqVwTLFMOE',//5
		'DBofficial G10 SARGE guide: www.youtube.com/watch?v=QPfu0URQliU&',//6
		'Warrior SWGOH Livestream t/s 10:06: www.youtube.com/watch?v=YAP5s-bavXE',//7
		'Bulldog g12 JKL destorys LS geo tb: www.youtube.com/watch?v=g_co0UtkMvA',//8
		],
		platims:[
		'Phase 1 Fleets (Self)',//0
		'Phase 2 Fleets',//1
		'Phase 3 Fleets',//2
		'Phase 4 Fleets',//3
		'Phase 1 Middle',//4
		'Phase 2 Middle',//5
		'Phase 3 Middle',//6
		'Phase 4 Middle',//7
		'Phase 1 Bottom',//8
		'Phase 2 Bottom',//9
		'Phase 3 Bottom',//10
		'Phase 4 Bottom',//11
		'Phase 2 Middle (Self)',//12
		'Phase 3 Middle (Self)',//13
		'Phase 4 Middle (Self)',//14
		'Phase 4 Bottom (Self)',//15
		],
		missions: [{
			id: 0,
			name: 'c1',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 511 500',
				'Wave 2: 867 000',
				'Wave 3: 1 242 500',
				'Wave 4: 1 837 500'
				],
			preferredSquads: [47],
			dangerousEnemies: [4,3,11,2,7]
			},	{
			id: 1,
			name: 'c2',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 2,750,000'
				],
			preferredSquads: [51,52,32],
			dangerousEnemies: [12,14,16],
			weblinks: [6,7],
			}, {
			id: 2,
			name: 'c3',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 511 500',
				'Wave 2: 867 000',
				'Wave 3: 1 242 500',
				'Wave 4: 1 837 500'
				],
			preferredSquads: [44,42,45],
			dangerousEnemies: [0,1,8,5,10]
			},
			{
			id: 3,
			name: 'c4',
			type: 'req',
			position: 'right',
			rewards: [
				'Wave 1: 867 000',
				'Wave 2: 1 837 500',
				],
			preferredSquads: [64,41],
			dangerousEnemies: [15]
			},
			{
			id: 4,
			name: 'c5',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 1 800 000',
				],
				preferredSquads: [51,52,32],
				dangerousEnemies: [12,14,16],
				weblinks : [6,7],
			}, 
			
			{
			id: 5,
			name: 'c6',
			type: 'special',
			position: 'right',
			rewards: [
				'32 GET2',
				],
				preferredSquads: [31],
				dangerousEnemies: [13],
			}, 
			{
			id: 6,
			name: 'c7',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 464 000',
				'Wave 2: 775 500',
				'Wave 3: 1 105 000',
				'Wave 4: 1 627 500'
				],
			preferredSquads: [72,44,42,45],
			dangerousEnemies: [4,2,3,10,7,11,8]
			},
			{id: 7, // GR Jedi mission
			name: 'c8',
			type: 'req',
			position: 'right',
			rewards: [
				'Wave 1: 603 200',
				'Wave 2: 1 008 150',
				'Wave 3: 1 436 500',
				'Wave 4: 2 115 750'
				],
			preferredSquads: [68],
			dangerousEnemies: [7,11,2]
			},
			{
			id: 8,
			name: 'c9',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 464 000',
				'Wave 2: 775 500',
				'Wave 3: 1 105 000',
				'Wave 4: 1 627 500'
				],
			preferredSquads: [42,44,45],
			dangerousEnemies: [4,2,3,10,7,11,8]
			},
			{
			id: 9,
			name: 'c10',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 464 000',
				'Wave 2: 775 500',
				'Wave 3: 1 105 000',
				'Wave 4: 1 627 500'
				],
			preferredSquads: [59,60,61,67],
			dangerousEnemies: [0,5,10,1],
			weblinks: [8],
			},
			{
			id: 10,
			name: 'c11',
			type: 'KAM',
			position: 'right',
			rewards: [
				'1 whole KAM Shard'
				],
		    weblinks: [1,2,0],
			preferredSquads: [23,70],
			dangerousEnemies: [9,6],
			},
			{
			id: 11,
			name: 'c12',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 900,000',
				],
			preferredSquads: [51,52,32],
			dangerousEnemies: [12,14,16],
			weblinks : [6,7],
			},
			{
			id: 12,
			name: 'c13',
			type: 'special',
			position: 'left',
			rewards: [
				'21 GET2',
				],
			preferredSquads: [31],
			dangerousEnemies: [13],
			//weblinks : [6],
			},
			{id: 13,
			name: 'c14',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 434 000',
				'Wave 2: 704 000',
				'Wave 3: 1 014 750',
				'Wave 4: 1 377 000'
				],
			preferredSquads: [69,55,54],
			dangerousEnemies: [0,2,11,7,10]
			},
			{
			id: 14,
			name: 'c15',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 434 000',
				'Wave 2: 704 000',
				'Wave 3: 1 014 750',
				'Wave 4: 1 377 000'
				],
			preferredSquads: [44,42,29,34,45],
			dangerousEnemies: [0,2,11,7,10],
			weblinks: [5],
			},
			{
			id: 15,
			name: 'c16',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 434 000',
				'Wave 2: 704 000',
				'Wave 3: 1 014 750',
				'Wave 4: 1 377 000'
				],
			preferredSquads: [42,34,29, 44, 45],
			dangerousEnemies: [0,5,1,8,4,3]
			},
			{
			id: 16,
			name: 'c17',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 434 000',
				'Wave 2: 704 000',
				'Wave 3: 1 014 750',
				'Wave 4: 1 377 000'
				],
			preferredSquads: [56,66,57,58],
			dangerousEnemies: [0,5,1,8,4,3],
			weblinks: [8],
			},
			{//LS New mission  Kenobi
		    id: 38,
		    name: 'ls1',
		    type: 'special',
		    position: 'left',
		    rewards: [
				'21 GET2'
				],
			preferredSquads: [22],
			dangerousEnemies: [3]
		    },
		    {
		    id: 41,
		    name: 'ls2',
		    type: 'special',
		    position: 'right',
		    rewards: [
				'25 GET2',
				],
			preferredSquads: [25],
			dangerousEnemies: [4,11,3],
		    },
		    {
		    id: 42,
		    name: 'ls3',
		    type: 'usual',
		    position: 'right',
		    rewards: [
				'Wave 1: 511 500',
				'Wave 2: 867 000',
				'Wave 3: 1 242 500',
				'Wave 4: 1 837 500'
				],
			preferredSquads: [42,44,45],
			dangerousEnemies: [4,3,11,2,7]
		    },
			{
			id: 17,
			name: 'c18',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 523 900',
				],
			preferredSquads: [31,32,51,52],	
			dangerousEnemies: [12,14,16],
			weblinks: [6,7],
			},
			{
			id: 18,
			name: 'c19',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 403 000',
				'Wave 2: 573 500',
				'Wave 3: 840 000',
				'Wave 4: 1 155 000',
				],
			preferredSquads: [65,46,30,33],
			dangerousEnemies: [2,7,3,11],
			weblinks: [8],
			},
			{id: 19,
			name: 'c20',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 403 000',
				'Wave 2: 573 500',
				'Wave 3: 840 000',
				'Wave 4: 1 155 000',
				],
			preferredSquads: [34,42,29,45,44],
			dangerousEnemies: [2,7,3,11]
			},
			{
			id: 20,//   -----------------Galactic Republic
			name: 'c21',
			type: 'special',
			position: 'left',
			rewards: [
				'15 GET2',
				],
				dangerousEnemies: [10,7,1,3],
				preferredSquads: [63,53,71]
			},
			{
			id: 21,
			name: 'c22',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 403 000',
				'Wave 2: 573 500',
				'Wave 3: 840 000',
				'Wave 4: 1 155 000',
				],
			preferredSquads: [42,44,29,45,34],
			dangerousEnemies: [5,10,4],
			weblinks: [5],
			},
			{
			id: 22, //---------Jedi mission
			name: 'c23',
			type: 'usual',
			position: 'left',
			rewards: [
				'Wave 1: 523 900',
				'Wave 2: 745 550',
				'Wave 3: 1 092 000',
				'Wave 4: 1 501 500',
				],
			preferredSquads: [46,65,30,33],
			dangerousEnemies: [10,4,1,5],
			weblinks: [8],
			},
			{
			id: 23,
			name: 's1',
			type: 'req',
			position: 'right',
			rewards: [
				'Wave 1: 664 950',
				'Wave 2: 1 127 100',
				'Wave 3: 1 615 250',
				'Wave 4: 2 388 750'
				],
			preferredSquads: [40],
			dangerousEnemies: [0,10,5,1]
			},
			/*{
			id: 24,
			name: 's2',
			type: 'usual',
			position: 'right',
			rewards: [
				'Wave 1: 464 000',
				'Wave 2: 775 500',
				'Wave 3: 1 105 000',
				'Wave 4: 1 627 500'
				],
				preferredSquads: [20],
			},*/
			{
			id: 25,
			name: 's3',
			type: 'req',
		    position: 'left',
		    rewards: [
				'Wave 1: 564 200',
				'Wave 2: 915 200',
				'Wave 3: 1 319 175',
				'Wave 4: 1 790 100'
				],
			weblinks: [3,4],
			preferredSquads: [21],
			dangerousEnemies: [1,2]
		    
			},
			{//-----Fleet special
			id: 26,
			name: 's4',
			type: 'special',
			position: 'right',
			rewards: [
				'20 GET2',
				],
			dangerousEnemies: [13],
			preferredSquads:[31]
			},
			
			/* Platoons */
			{id: 27,
			name: 't1',
			type: 'platoon',
			position: 'right',
			requiredToons: [9],
			 platzones: [6,10,7,11]
			},
			{id: 28, name: 'b1', type: 'platoon', position: 'right', requiredToons: [11], platzones: [15,7]},
			{id: 29, name: 't2', type: 'platoon', position: 'right', requiredToons: [6], platzones: [7,11]},
			{id: 30, name: 'm2', type: 'platoon', position: 'right', requiredToons: [7], platzones: [13,10,7,11]},
			{id: 31, name: 'b2', type: 'platoon', position: 'right', requiredToons: [8], platzones: [7,11]},
			{id: 32, name: 't3', type: 'platoon', position: 'left', requiredToons: [3], platzones: [6,10]},
			{id: 40, name: 'lsp1', type: 'platoon', position: 'right', requiredToons: [10], platzones: [14,11]},
			{id: 33, name: 'm3', type: 'platoon', position: 'left', requiredToons: [4], platzones: [12,6]},
			{id: 34, name: 'b3', type: 'platoon', position: 'left', requiredToons: [5], platzones: [6,10]},
			{id: 35, name: 't4', type: 'platoon', position: 'left', requiredToons: [0], platzones: [0,1,2,3]},
			{id: 36, name: 'm4', type: 'platoon', position: 'left', requiredToons: [1], platzones: [5]},
			{id: 37, name: 'b4', type: 'platoon', position: 'left', requiredToons: [2], platzones: [5,9]}
		],
		selectedMission: '',
		seen: false,
		hide: function() {
			this.seen = false;
		}
	}
	},
	template: '#mission',
	methods: {
		mq () {
			this.isMobile = window.matchMedia('(max-width: 600px)').matches;
		},
		
	}
})

let app = new Vue({
	el: '#app',
	data: {
		isVisible: false
	},
});
