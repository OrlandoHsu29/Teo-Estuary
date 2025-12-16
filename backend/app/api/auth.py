"""认证相关蓝图"""
from flask import Blueprint, render_template, session, redirect, url_for, request, jsonify, current_app
import logging
from app.utils.decorators import admin_required

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """管理员登录"""
    if request.method == 'GET':
        if session.get('admin_logged_in'):
            return redirect(url_for('admin.dashboard'))
        return render_template('admin_login.html', error=None)

    username = request.form.get('username', '').strip()
    password = request.form.get('password', '').strip()

    if not username or not password:
        return render_template('admin_login.html', error='请输入用户名和密码')

    if username == current_app.config['ADMIN_USERNAME'] and password == current_app.config['ADMIN_PASSWORD']:
        session['admin_logged_in'] = True
        session.permanent = True
        logger.info(f"Admin login successful for user: {username}")
        return redirect(url_for('admin.dashboard'))
    else:
        logger.warning(f"Admin login failed for user: {username}")
        return render_template('admin_login.html', error='用户名或密码错误')


@auth_bp.route('/admin/logout')
def admin_logout():
    """管理员登出"""
    session.pop('admin_logged_in', None)
    logger.info("Admin logged out")
    return redirect(url_for('auth.admin_login'))


@auth_bp.route('/api/apikey-verify', methods=['POST'])
def apikey_verify():
    """验证apikey的接口"""
    from app.utils.decorators import verify_api_key

    key_obj, error = verify_api_key(request)
    if error:
        return jsonify({'success': False, 'error': error['error']}), 401

    return jsonify({'success': True})