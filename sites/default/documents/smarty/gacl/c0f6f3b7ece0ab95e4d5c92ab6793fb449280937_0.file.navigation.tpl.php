<?php
/* Smarty version 4.5.6, created on 2026-06-24 18:27:56
  from 'C:\xampp\htdocs\openemr\gacl\admin\templates\phpgacl\navigation.tpl' */

/* @var Smarty_Internal_Template $_smarty_tpl */
if ($_smarty_tpl->_decodeProperties($_smarty_tpl, array (
  'version' => '4.5.6',
  'unifunc' => 'content_6a3c058cdceb38_27697384',
  'has_nocache_code' => false,
  'file_dependency' => 
  array (
    'c0f6f3b7ece0ab95e4d5c92ab6793fb449280937' => 
    array (
      0 => 'C:\\xampp\\htdocs\\openemr\\gacl\\admin\\templates\\phpgacl\\navigation.tpl',
      1 => 1779233537,
      2 => 'file',
    ),
  ),
  'includes' => 
  array (
  ),
),false)) {
function content_6a3c058cdceb38_27697384 (Smarty_Internal_Template $_smarty_tpl) {
?>		<div id="top-tr"><div id="top-tl"><div id="top-br"><div id="top-bl">
			<h1><span>phpGACL</span></h1>
			<h2><?php echo text($_smarty_tpl->tpl_vars['page_title']->value);?>
</h2>
<?php if (!(isset($_smarty_tpl->tpl_vars['hidemenu']->value)) || $_smarty_tpl->tpl_vars['hidemenu']->value != TRUE) {?>
            <p><a href='../../interface/usergroup/adminacl.php' onclick='top.restoreSession()'><span style='font-size: 80%;'>(Back to OpenEMR's ACL menu)</span></a></p>
			<ul id="menu">
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'aro_group') {?> class="current"<?php }?>><a href="group_admin.php?group_type=aro">ARO Group Admin</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'axo_group') {?> class="current"<?php }?>><a href="group_admin.php?group_type=axo">AXO Group Admin</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'acl_admin') {?> class="current"<?php }?>><a href="acl_admin.php?return_page=acl_admin.php">ACL Admin</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'acl_list') {?> class="current"<?php }?>><a href="acl_list.php?return_page=acl_list.php">ACL List</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'acl_test') {?> class="current"<?php }?>><a href="acl_test.php">ACL Test</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'acl_debug') {?> class="current"<?php }?>><a href="acl_debug.php">ACL Debug</a></li>
				<li<?php if ($_smarty_tpl->tpl_vars['current']->value == 'about') {?> class="current"<?php }?>><a href="about.php">About</a></li>
				<li><a href="../docs/manual.html" rel="noopener" target="_blank">Manual</a></li>
				<li><a href="../docs/phpdoc/" rel="noopener" target="_blank">API Guide</a></li>
			</ul>
<?php }?>
		</div></div></div></div>

		<div id="mid-r"><div id="mid-l">
<?php }
}
