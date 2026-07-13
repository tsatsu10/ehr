<?php
/* Smarty version 4.5.6, created on 2026-07-07 04:04:55
  from 'C:\xampp\htdocs\openemr\gacl\admin\templates\phpgacl\pager.tpl' */

/* @var Smarty_Internal_Template $_smarty_tpl */
if ($_smarty_tpl->_decodeProperties($_smarty_tpl, array (
  'version' => '4.5.6',
  'unifunc' => 'content_6a4c7ae73b2d63_62278109',
  'has_nocache_code' => false,
  'file_dependency' => 
  array (
    '398333e3f6eb5d3daeb81760b695081300aef02d' => 
    array (
      0 => 'C:\\xampp\\htdocs\\openemr\\gacl\\admin\\templates\\phpgacl\\pager.tpl',
      1 => 1779233537,
      2 => 'file',
    ),
  ),
  'includes' => 
  array (
  ),
),false)) {
function content_6a4c7ae73b2d63_62278109 (Smarty_Internal_Template $_smarty_tpl) {
?><table width="100%" cellspacing="0" cellpadding="2" border="0">
  <tr valign="middle">
    <td align="left">
<?php if ((isset($_smarty_tpl->tpl_vars['paging_data']->value['atfirstpage'])) && $_smarty_tpl->tpl_vars['paging_data']->value['atfirstpage']) {?>
      |&lt; &lt;&lt;
<?php } else { ?>
      <a href="<?php echo $_smarty_tpl->tpl_vars['link']->value;?>
page=1">|&lt;</a> <a href="<?php echo $_smarty_tpl->tpl_vars['link']->value;?>
page=<?php if ((isset($_smarty_tpl->tpl_vars['paging_data']->value['prevpage']))) {
echo text($_smarty_tpl->tpl_vars['paging_data']->value['prevpage']);
}?>">&lt;&lt;</a>
<?php }?>
    </td>
    <td align="right">
<?php if ((isset($_smarty_tpl->tpl_vars['paging_data']->value['atlastpage'])) && $_smarty_tpl->tpl_vars['paging_data']->value['atlastpage']) {?>
      &gt;&gt; &gt;|
<?php } else { ?>
      <a href="<?php echo $_smarty_tpl->tpl_vars['link']->value;?>
page=<?php if ((isset($_smarty_tpl->tpl_vars['paging_data']->value['nextpage']))) {
echo text($_smarty_tpl->tpl_vars['paging_data']->value['nextpage']);
}?>">&gt;&gt;</a> <a href="<?php echo $_smarty_tpl->tpl_vars['link']->value;?>
page=<?php if ((isset($_smarty_tpl->tpl_vars['paging_data']->value['lastpageno']))) {
echo text($_smarty_tpl->tpl_vars['paging_data']->value['lastpageno']);
}?>">&gt;|</a>
<?php }?>
    </td>
  </tr>
</table>
<?php }
}
