"""管理员界面蓝图"""
from flask import Blueprint, render_template, redirect, url_for
from app.utils.decorators import admin_required

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/admin')
@admin_required
def dashboard():
    """管理界面"""
    return render_template('admin.html')